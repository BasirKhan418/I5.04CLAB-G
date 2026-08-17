import "dotenv/config";
import { createServer, type IncomingMessage } from "http";
import type { Socket } from "net";
import IORedis from "ioredis";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  CAM_MAX_FRAME_BYTES,
  DOOR_CHANNEL,
  DOOR_PRESENCE_CHANNEL,
  DOOR_PRESENCE_KEY,
  SESSION_COOKIE,
} from "../lib/constants";
import { getEnv } from "../lib/env";
import { enqueueDoorOpen, flushQueuedDoorOpens } from "../lib/door-queue";
import type { DoorOpenReason } from "../lib/door";
import { verifyCamTicket, verifySession } from "../lib/jwt";

type DoorSocket = WebSocket & { misses?: number; device?: string };

const HEARTBEAT_MS = 15_000;
const MAX_MISSES = 8;
const JPEG_SOI = Buffer.from([0xff, 0xd8]);
const DOOR_MAX_PAYLOAD = CAM_MAX_FRAME_BYTES + 4096;

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
    /* drop this frame, keep the socket */
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
  const pub = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(1000 * times, 8000),
    enableOfflineQueue: true,
  });

  function liveSockets() {
    return [...clients].filter((socket) => socket.readyState === WebSocket.OPEN);
  }

  function presenceSnapshot() {
    const live = liveSockets();
    const devices = live
      .map((socket) => socket.device)
      .filter((name): name is string => Boolean(name));
    return {
      type: "presence" as const,
      online: live.length > 0,
      clients: live.length,
      devices,
      updatedAt: new Date().toISOString(),
    };
  }

  async function publishPresence() {
    const snapshot = presenceSnapshot();
    try {
      await pub.set(DOOR_PRESENCE_KEY, JSON.stringify(snapshot), "EX", 90);
      await pub.publish(DOOR_PRESENCE_CHANNEL, JSON.stringify(snapshot));
    } catch {
      /* dashboard falls back to /health */
    }
  }

  function tellDoorCam(on: boolean) {
    for (const socket of clients) {
      send(socket, { type: on ? "cam-on" : "cam-off" });
    }
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
      const snapshot = presenceSnapshot();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          ok: true,
          online: snapshot.online,
          clients: snapshot.clients,
          devices: snapshot.devices,
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
    maxPayload: DOOR_MAX_PAYLOAD,
  });
  const camWss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: DOOR_MAX_PAYLOAD,
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
      cam: true,
      stream: "on-demand",
    });
    if (viewers.size > 0) {
      send(socket, { type: "cam-on" });
    }
    console.info(`door client connected (${liveSockets().length} live)`);
    void publishPresence();
    void flushQueuedDoorOpens().then((n) => {
      if (n > 0) {
        console.info(`flushed ${n} queued door open(s)`);
      }
    });

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
        const msg = JSON.parse(buf.toString("utf8")) as {
          type?: string;
          device?: string;
        };
        if (msg.type === "ping") {
          send(socket, { type: "pong" });
        }
        if (msg.type === "hello" && msg.device) {
          const device = String(msg.device).trim().slice(0, 64);
          if (device && socket.device !== device) {
            socket.device = device;
            void publishPresence();
          }
        }
      } catch {
        /* ignore */
      }
    });
    socket.on("close", () => {
      clients.delete(socket);
      console.info(`door client left (${liveSockets().length} live)`);
      void publishPresence();
    });
    socket.on("error", () => {
      /* close handler removes the socket; do not drop a live board here */
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
        live: true,
        viewers: viewers.size,
      });
      if (lastFrame && Date.now() - lastFrameAt < 2_000) {
        try {
          socket.send(lastFrame, { binary: true });
        } catch {
          /* next live frame will follow */
        }
      }
      if (viewers.size === 1) {
        tellDoorCam(true);
      }
      console.info(`cam viewer connected (${viewers.size} watching)`);

      socket.on("close", () => {
        viewers.delete(socket);
        console.info(`cam viewer left (${viewers.size} watching)`);
        if (viewers.size === 0) {
          lastFrame = null;
          lastFrameAt = 0;
          tellDoorCam(false);
        }
      });
      socket.on("error", () => {
        /* close handler updates viewers */
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
    void publishPresence();
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
    if (n > 0) return;
    try {
      const event = JSON.parse(raw) as {
        type?: string;
        reason?: DoorOpenReason;
        at?: string;
      };
      if (event.type === "open" && event.reason) {
        void enqueueDoorOpen(event.reason, event.at);
        console.info("no live board, open queued until it reconnects");
      }
    } catch {
      /* ignore */
    }
  });
  sub.on("error", (err) => {
    console.error("door redis error", err.message);
  });
  sub.on("ready", () => {
    void listenDoor();
  });
  pub.on("ready", () => {
    void publishPresence();
  });
  await listenDoor();
  void publishPresence();

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
    void pub.quit();
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
