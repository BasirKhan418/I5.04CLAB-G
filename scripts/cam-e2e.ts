import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import "dotenv/config";
import IORedis from "ioredis";
import { WebSocket } from "ws";
import { DOOR_CHANNEL } from "../lib/constants";
import { signCamTicket } from "../lib/jwt";

const PORT = 18787;
const BASE = `ws://127.0.0.1:${PORT}`;

type Json = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(message);
}

function onceClose(ws: WebSocket) {
  return new Promise<number>((resolve) => {
    ws.on("close", (code) => resolve(code));
    ws.on("error", () => {
      /* close follows */
    });
  });
}

function collect(ws: WebSocket) {
  const texts: Json[] = [];
  const bins: Buffer[] = [];
  ws.on("message", (raw, isBinary) => {
    if (isBinary || Buffer.isBuffer(raw)) {
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
      if (buf[0] === 0xff && buf[1] === 0xd8) {
        bins.push(buf);
        return;
      }
      if (isBinary) {
        bins.push(buf);
        return;
      }
    }
    try {
      texts.push(JSON.parse(String(raw)) as Json);
    } catch {
      /* ignore */
    }
  });
  return { texts, bins };
}

async function waitUntil(
  check: () => boolean,
  label: string,
  ms = 4000
) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (check()) return;
    await sleep(40);
  }
  fail(`timeout: ${label}`);
}

async function waitHealth(path: string, pred: (body: Json) => boolean) {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as Json;
        if (pred(body)) return body;
      }
    } catch {
      /* still booting */
    }
    await sleep(80);
  }
  fail(`timeout waiting for ${path}`);
}

async function main() {
  const token = process.env.DOOR_DEVICE_TOKEN?.trim();
  const redisUrl = process.env.REDIS_URL;
  const secret = process.env.JWT_SECRET;
  if (!token) fail("DOOR_DEVICE_TOKEN missing");
  if (!redisUrl) fail("REDIS_URL missing");
  if (!secret) fail("JWT_SECRET missing");

  const child: ChildProcess = spawn(
    "npx",
    ["tsx", "server/door-ws.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DOOR_WS_PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let logs = "";
  child.stdout?.on("data", (chunk) => {
    logs += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    logs += String(chunk);
  });

  const stop = () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  };
  process.on("exit", stop);

  try {
    await waitHealth("/health", (body) => body.ok === true);
    console.log("1. health ok");

    const badDoor = new WebSocket(`${BASE}/door?token=wrong`);
    const badDoorCode = await onceClose(badDoor);
    if (badDoorCode !== 4001) fail(`wrong door token close ${badDoorCode}`);
    console.log("2. door rejects bad token (4001)");

    const badCam = new WebSocket(`${BASE}/cam`);
    const badCamCode = await onceClose(badCam);
    if (badCamCode !== 4001) fail(`open cam close ${badCamCode}`);
    console.log("3. cam rejects missing ticket (4001)");

    const door = new WebSocket(`${BASE}/door?token=${encodeURIComponent(token)}`);
    const doorMsgs = collect(door);
    await new Promise<void>((resolve, reject) => {
      door.on("open", () => resolve());
      door.on("error", reject);
    });
    await waitUntil(
      () => doorMsgs.texts.some((m) => m.type === "hello"),
      "door hello"
    );
    const hello = doorMsgs.texts.find((m) => m.type === "hello");
    if (hello?.cam !== false) fail("hello.cam should be false with no viewers");
    if (hello?.holdMs !== 2500 && typeof hello?.holdMs !== "number") {
      fail("hello missing holdMs");
    }
    console.log("4. fake ESP32 connected, got hello");

    door.send(JSON.stringify({ type: "ping" }));
    await waitUntil(
      () => doorMsgs.texts.some((m) => m.type === "pong"),
      "door pong"
    );
    console.log("5. ping/pong ok");

    const ticket = await signCamTicket("e2e-user");
    const viewer = new WebSocket(
      `${BASE}/cam?ticket=${encodeURIComponent(ticket)}`
    );
    const viewMsgs = collect(viewer);
    await new Promise<void>((resolve, reject) => {
      viewer.on("open", () => resolve());
      viewer.on("error", reject);
    });
    await waitUntil(
      () => viewMsgs.texts.some((m) => m.type === "hello"),
      "viewer hello"
    );
    await waitUntil(
      () => doorMsgs.texts.some((m) => m.type === "cam-on"),
      "cam-on to board"
    );
    if (viewMsgs.bins.length !== 0) {
      fail("viewer got a stale JPEG on connect");
    }
    console.log("6. viewer connected, board got cam-on, no stale frame");

    const jpeg1 = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from("LIVE-FRAME-ONE"),
      Buffer.from([0xff, 0xd9]),
    ]);
    door.send(jpeg1, { binary: true });
    await waitUntil(() => viewMsgs.bins.length >= 1, "first live jpeg");
    if (!viewMsgs.bins[0].equals(jpeg1)) fail("first jpeg mismatch");
    console.log("7. live JPEG relayed (not a cached still)");

    const ticket2 = await signCamTicket("e2e-user-2");
    const viewer2 = new WebSocket(
      `${BASE}/cam?ticket=${encodeURIComponent(ticket2)}`
    );
    const view2Msgs = collect(viewer2);
    await new Promise<void>((resolve, reject) => {
      viewer2.on("open", () => resolve());
      viewer2.on("error", reject);
    });
    await sleep(200);
    if (view2Msgs.bins.length !== 0) {
      fail("second viewer received replayed old JPEG");
    }
    const jpeg2 = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from("LIVE-FRAME-TWO"),
      Buffer.from([0xff, 0xd9]),
    ]);
    door.send(jpeg2, { binary: true });
    await waitUntil(() => viewMsgs.bins.length >= 2, "viewer1 jpeg2");
    await waitUntil(() => view2Msgs.bins.length >= 1, "viewer2 jpeg2");
    if (!view2Msgs.bins[0].equals(jpeg2)) fail("viewer2 should only get live frame two");
    console.log("8. second viewer gets only the next live frame");

    const redis = new IORedis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    await redis.publish(
      DOOR_CHANNEL,
      JSON.stringify({
        type: "open",
        holdMs: 2500,
        reason: "visitor-approve",
        at: new Date().toISOString(),
      })
    );
    await waitUntil(
      () =>
        doorMsgs.texts.some(
          (m) => m.type === "open" && m.reason === "visitor-approve"
        ),
      "redis door open"
    );
    await redis.quit();
    console.log("9. open command reached the board (buzzer path)");

    const health = await waitHealth("/health", (body) => {
      return (
        body.ok === true &&
        body.clients === 1 &&
        body.viewers === 2 &&
        (body.cam as Json).live === true
      );
    });
    console.log("10. health", JSON.stringify({
      clients: health.clients,
      viewers: health.viewers,
      cam: health.cam,
    }));

    viewer.close();
    viewer2.close();
    await waitUntil(
      () => doorMsgs.texts.some((m) => m.type === "cam-off"),
      "cam-off after last viewer"
    );
    console.log("11. last viewer left, board got cam-off");

    door.close();
    console.log("\nAll door/camera e2e checks passed.");
  } finally {
    stop();
    await sleep(300);
    if (logs.includes("Error") || logs.includes("throw")) {
      console.error(logs.slice(-1500));
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
