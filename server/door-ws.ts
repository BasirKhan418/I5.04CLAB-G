import "dotenv/config";
import { createServer, type IncomingMessage } from "http";
import type { Socket } from "net";
import IORedis from "ioredis";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  CAM_MAX_FRAME_BYTES,
  DOOR_CHANNEL,
  SESSION_COOKIE,
} from "../lib/constants";
import { getEnv } from "../lib/env";
import { verifyCamTicket, verifySession } from "../lib/jwt";

type DoorSocket = WebSocket & { misses?: number };

const HEARTBEAT_MS = 15_000;
const MAX_MISSES = 4;
const JPEG_SOI = Buffer.from([0xff, 0xd8]);

function tokenFromRequest(url: URL, headers: NodeJS.Dict<string | string[]>) {
  const query = url.searchParams.get("token")?.trim();
  if (query) return query;
  const header = headers["x-door-token"];
  if (typeof header === "string") return header.trim();
  if (Array.isArray(header) && header[0]) return header[0].trim();
  const auth = headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function cookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
  }
}

function asBuffer(raw: RawData) {
  if (Buffer.isBuffer(raw)) return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw);
  return Buffer.from(raw);
}

function isJpeg(buf: Buffer) {
  return buf.length >= 2 && buf[0] === JPEG_SOI[0] && buf[1] === JPEG_SOI[1];
}

function hardenTcp(socket: Socket) {
  socket.setKeepAlive(true, 10_000);
  socket.setNoDelay(true);
  socket.setTimeout(0);
}

async function viewerAllowed(req: IncomingMessage, url: URL) {
  const ticket = url.searchParams.get("ticket")?.trim();
  if (ticket && (await verifyCamTicket(ticket))) return true;
  const session = cookieValue(req.headers.cookie, SESSION_COOKIE);
  if (session && (await verifySession(session))) return true;
  return false;
}

async function main() {
  const env = getEnv();
  if (!env.doorDeviceToken) {
    throw new Error("Set DOOR_DEVICE_TOKEN in .env");
  }

  const clients = new Set<DoorSocket>();
  const viewers = new Set<WebSocket>();
  let lastFrame: Buffer | null = null;
  let lastFrameAt = 0;

  function tellDoorCam(on: boolean) {
    for (const socket of clients) {
      send(socket, { type: on ? "cam-on" : "cam-off" });
    }
  }

  function setViewerCount() {
    tellDoorCam(viewers.size > 0);
  }

  function broadcastFrame(buf: Buffer) {
    lastFrame = buf;
    lastFrameAt = Date.now();
    for (const viewer of viewers) {
      if (viewer.readyState !== WebSocket.OPEN) continue;
      if (viewer.bufferedAmount > 0) continue;
      try {
        viewer.send(buf, { binary: true });
      } catch {
        /* keep going */
      }
    }
  }

  const httpServer = createServer((req, res) => {
    if (req.url?.startsWith("/health")) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          ok: true,
          clients: clients.size,
          viewers: viewers.size,
          cam: {
            live: Boolean(lastFrame) && Date.now() - lastFrameAt < 8_000,
            lastFrameAt: lastFrameAt || null,
            bytes: lastFrame?.length ?? 0,
          },
          uptime: Math.round(process.uptime()),
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  httpServer.on("connection", hardenTcp);
  httpServer.keepAliveTimeout = 0;
  httpServer.headersTimeout = 0;
  httpServer.requestTimeout = 0;
  httpServer.timeout = 0;

  const doorWss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  });
  const camWss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  });

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.socket) hardenTcp(req.socket);
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.pathname === "/door") {
      doorWss.handleUpgrade(req, socket, head, (ws) => {
        doorWss.emit("connection", ws, req);
      });
      return;
    }
    if (url.pathname === "/cam") {
      camWss.handleUpgrade(req, socket, head, (ws) => {
        camWss.emit("connection", ws, req);
      });
      return;
    }
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  });

  doorWss.on("connection", (socket: DoorSocket, req) => {
    if (req.socket) hardenTcp(req.socket);
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/door", `http://${host}`);
    if (tokenFromRequest(url, req.headers) !== env.doorDeviceToken) {
      socket.close(4001, "unauthorized");
      return;
    }

    socket.misses = 0;
    clients.add(socket);
    send(socket, {
      type: "hello",
      holdMs: env.doorOpenMs,
      heartbeatMs: HEARTBEAT_MS,
      cam: viewers.size > 0,
    });
    if (viewers.size > 0) {
      send(socket, { type: "cam-on" });
    }
    console.info(`door client connected (${clients.size} live)`);

    const touch = () => {
      socket.misses = 0;
    };

    socket.on("pong", touch);
    socket.on("message", (raw, isBinary) => {
      touch();
      const buf = asBuffer(raw);
      if (isBinary || isJpeg(buf)) {
        if (buf.length > 0 && buf.length <= CAM_MAX_FRAME_BYTES && isJpeg(buf)) {
          broadcastFrame(buf);
        }
        return;
      }
      try {
        const msg = JSON.parse(buf.toString("utf8")) as { type?: string };
        if (msg.type === "ping") {
          send(socket, { type: "pong" });
        }
      } catch {
        /* ignore */
      }
    });
    socket.on("close", () => {
      clients.delete(socket);
      console.info(`door client left (${clients.size} live)`);
    });
    socket.on("error", () => {
      clients.delete(socket);
    });
  });

  camWss.on("connection", (socket, req) => {
    void (async () => {
      if (req.socket) hardenTcp(req.socket);
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.url ?? "/cam", `http://${host}`);
      if (!(await viewerAllowed(req, url))) {
        socket.close(4001, "unauthorized");
        return;
      }

      viewers.add(socket);
      send(socket, {
        type: "hello",
        live: clients.size > 0,
        viewers: viewers.size,
      });
      if (viewers.size === 1) setViewerCount();
      console.info(`cam viewer connected (${viewers.size} watching)`);

      socket.on("close", () => {
        viewers.delete(socket);
        if (viewers.size === 0) {
          lastFrame = null;
          lastFrameAt = 0;
          setViewerCount();
        }
        console.info(`cam viewer left (${viewers.size} watching)`);
      });
      socket.on("error", () => {
        viewers.delete(socket);
        if (viewers.size === 0) {
          lastFrame = null;
          lastFrameAt = 0;
          setViewerCount();
        }
      });
    })();
  });

  const heartbeat = setInterval(() => {
    for (const socket of clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        clients.delete(socket);
        continue;
      }
      socket.misses = (socket.misses ?? 0) + 1;
      if (socket.misses > MAX_MISSES) {
        console.warn("door client silent too long, waiting for it to reconnect");
        socket.terminate();
        clients.delete(socket);
        continue;
      }
      send(socket, { type: "ping" });
      try {
        socket.ping();
      } catch {
      }
    }
    for (const viewer of viewers) {
      if (viewer.readyState !== WebSocket.OPEN) {
        viewers.delete(viewer);
        continue;
      }
      try {
        viewer.ping();
      } catch {
        /* ignore */
      }
    }
    if (viewers.size === 0) {
      /* cam-off already sent when last viewer left */
    }
  }, HEARTBEAT_MS);

  const redisOpts = {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(1000 * times, 8000),
    enableOfflineQueue: true,
  };
  const sub = new IORedis(env.redisUrl, redisOpts);

  async function listenDoor() {
    await sub.subscribe(DOOR_CHANNEL);
    console.info("door redis channel subscribed");
  }

  sub.on("message", (_channel, raw) => {
    let n = 0;
    for (const socket of clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      try {
        socket.send(raw);
        n += 1;
      } catch {
        /* keep going */
      }
    }
    console.info(`door open sent to ${n} client(s)`);
  });
  sub.on("error", (err) => {
    console.error("door redis error", err.message);
  });
  await listenDoor();

  const shutdown = () => {
    clearInterval(heartbeat);
    for (const socket of clients) {
      try {
        socket.close(1001, "server stop");
      } catch {
        /* ignore */
      }
    }
    for (const viewer of viewers) {
      try {
        viewer.close(1001, "server stop");
      } catch {
        /* ignore */
      }
    }
    doorWss.close();
    camWss.close();
    httpServer.close();
    void sub.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  httpServer.listen(env.doorWsPort, "0.0.0.0", () => {
    console.info(
      `I5.04C Lab door socket ws://0.0.0.0:${env.doorWsPort}/door`
    );
    console.info(
      `I5.04C Lab camera watch ws://0.0.0.0:${env.doorWsPort}/cam`
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
