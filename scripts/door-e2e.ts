import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import "dotenv/config";
import IORedis from "ioredis";
import { WebSocket } from "ws";
import { DOOR_CHANNEL } from "../lib/constants";

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
  ws.on("message", (raw) => {
    try {
      texts.push(JSON.parse(String(raw)) as Json);
    } catch {
      /* ignore binary / junk */
    }
  });
  return { texts };
}

async function waitUntil(check: () => boolean, label: string, ms = 4000) {
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
  if (!token) fail("DOOR_DEVICE_TOKEN missing");
  if (!redisUrl) fail("REDIS_URL missing");

  const child: ChildProcess = spawn("npx", ["tsx", "server/door-ws.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DOOR_WS_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

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

    const noCam = new WebSocket(`${BASE}/cam`);
    const noCamCode = await Promise.race([
      onceClose(noCam),
      sleep(1500).then(() => -1),
    ]);
    if (noCam.readyState === WebSocket.OPEN) {
      fail("/cam must not accept a socket (camera removed)");
    }
    if (noCamCode === -1 && noCam.readyState === WebSocket.CONNECTING) {
      noCam.close();
    }
    console.log("3. /cam is gone");

    const door = new WebSocket(
      `${BASE}/door?token=${encodeURIComponent(token)}`
    );
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
    if (hello?.cam != null) fail("hello must not include cam");
    if (hello?.stream != null) fail("hello must not include stream");
    if (typeof hello?.holdMs !== "number") fail("hello missing holdMs");
    if (doorMsgs.texts.some((m) => m.type === "cam-on")) {
      fail("must not send cam-on");
    }
    console.log("4. lock connected, hello is JSON-only");

    door.send(JSON.stringify({ type: "hello", device: "esp32-door-1" }));
    door.send(JSON.stringify({ type: "ping" }));
    await waitUntil(
      () => doorMsgs.texts.some((m) => m.type === "pong"),
      "door pong"
    );
    console.log("5. ping/pong ok");

    const healthOnline = await waitHealth("/health", (body) => {
      return (
        body.ok === true &&
        body.online === true &&
        body.clients === 1 &&
        Array.isArray(body.devices) &&
        (body.devices as string[]).includes("esp32-door-1") &&
        body.viewers == null &&
        body.cam == null
      );
    });
    console.log(
      "6. health",
      JSON.stringify({
        clients: healthOnline.clients,
        devices: healthOnline.devices,
      })
    );

    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
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
    console.log("7. open command reached the board");

    door.send(Buffer.from([0xff, 0xd8, 0x00, 0xff, 0xd9]), { binary: true });
    await sleep(200);
    if (door.readyState !== WebSocket.OPEN) {
      fail("door socket dropped after stray binary");
    }
    door.send(JSON.stringify({ type: "ping" }));
    await waitUntil(
      () => doorMsgs.texts.filter((m) => m.type === "pong").length >= 2,
      "pong after binary junk"
    );
    console.log("8. lock socket stayed up after ignored binary");

    door.close();
    await onceClose(door);

    const door2 = new WebSocket(
      `${BASE}/door?token=${encodeURIComponent(token)}`
    );
    const door2Msgs = collect(door2);
    await new Promise<void>((resolve, reject) => {
      door2.on("open", () => resolve());
      door2.on("error", reject);
    });
    await waitUntil(
      () => door2Msgs.texts.some((m) => m.type === "hello"),
      "reconnect hello"
    );
    if (door2Msgs.texts.some((m) => m.type === "cam-on")) {
      fail("reconnect must not send cam-on");
    }
    door2.send(JSON.stringify({ type: "ping" }));
    await waitUntil(
      () => door2Msgs.texts.some((m) => m.type === "pong"),
      "reconnect pong"
    );
    door2.close();
    console.log("9. board reconnect stays JSON-only");

    console.log("\nAll door e2e checks passed.");
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
