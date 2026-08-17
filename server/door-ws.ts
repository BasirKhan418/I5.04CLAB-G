import "dotenv/config";
import { createServer } from "http";
import type { Socket } from "net";
import IORedis from "ioredis";
import { WebSocket, WebSocketServer } from "ws";
import {
  DOOR_CHANNEL,
  DOOR_PRESENCE_CHANNEL,
  DOOR_PRESENCE_KEY,
} from "../lib/constants";
import { getEnv } from "../lib/env";

type DoorSocket = WebSocket & { misses?: number; device?: string };

const HEARTBEAT_MS = 15_000;
const MAX_MISSES = 4;

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

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    /* drop this frame, keep the socket */
  }
}

function hardenTcp(socket: Socket) {
  socket.setKeepAlive(true, 10_000);
  socket.setNoDelay(true);
  socket.setTimeout(0);
}

async function main() {
  const env = getEnv();
  if (!env.doorDeviceToken) {
    throw new Error("Set DOOR_DEVICE_TOKEN in .env");
  }

  const clients = new Set<DoorSocket>();
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

  const wss = new WebSocketServer({
    server: httpServer,
    path: "/door",
    perMessageDeflate: false,
    clientTracking: true,
  });

  wss.on("connection", (socket: DoorSocket, req) => {
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
    });
    console.info(`door client connected (${liveSockets().length} live)`);
    void publishPresence();

    const touch = () => {
      socket.misses = 0;
    };

    socket.on("pong", touch);
    socket.on("message", (raw) => {
      touch();
      try {
        const msg = JSON.parse(String(raw)) as {
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
      clients.delete(socket);
      void publishPresence();
    });
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
        /* ESP32 may ignore RFC ping; JSON ping above is the real keepalive */
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
    wss.close();
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
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
