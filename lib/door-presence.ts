import IORedis from "ioredis";
import { DOOR_PRESENCE_CHANNEL, DOOR_PRESENCE_KEY } from "@/lib/constants";
import {
  emptyDoorPresence,
  type DoorPresence,
} from "@/lib/door-presence-types";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";

export type { DoorPresence } from "@/lib/door-presence-types";
export { emptyDoorPresence } from "@/lib/door-presence-types";

const STALE_MS = 45_000;

function normalize(raw: unknown, configured: boolean): DoorPresence | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as {
    clients?: unknown;
    devices?: unknown;
    updatedAt?: unknown;
  };
  const clients = Number(data.clients);
  if (!Number.isFinite(clients) || clients < 0) return null;
  const devices = Array.isArray(data.devices)
    ? data.devices.filter((name): name is string => typeof name === "string")
    : [];
  const updatedAt =
    typeof data.updatedAt === "string" && data.updatedAt
      ? data.updatedAt
      : null;
  return {
    online: clients > 0,
    clients,
    devices,
    updatedAt,
    configured,
  };
}

function isFresh(presence: DoorPresence) {
  if (!presence.updatedAt) return false;
  const age = Date.now() - new Date(presence.updatedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < STALE_MS;
}

async function readHealth(configured: boolean): Promise<DoorPresence | null> {
  const port = getEnv().doorWsPort;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return normalize(
      {
        ...(typeof data === "object" && data ? data : {}),
        updatedAt: new Date().toISOString(),
      },
      configured
    );
  } catch {
    return null;
  }
}

export async function getLiveDoorPresence(): Promise<DoorPresence> {
  const configured = Boolean(getEnv().doorDeviceToken);
  const fromHealth = await readHealth(configured);
  if (fromHealth) return fromHealth;
  return getDoorPresence();
}

export async function getDoorPresence(): Promise<DoorPresence> {
  const configured = Boolean(getEnv().doorDeviceToken);
  try {
    const raw = await getRedis().get(DOOR_PRESENCE_KEY);
    if (raw) {
      const fromRedis = normalize(JSON.parse(raw), configured);
      if (fromRedis && isFresh(fromRedis)) return fromRedis;
    }
  } catch {
    /* fall through to health */
  }

  const fromHealth = await readHealth(configured);
  if (fromHealth) return fromHealth;
  return emptyDoorPresence(configured);
}

export function publicDoorPresence(presence: DoorPresence) {
  return {
    online: presence.online,
    clients: presence.clients,
    configured: presence.configured,
    updatedAt: presence.updatedAt,
  };
}

export function subscribeDoorPresence(onEvent: (presence: DoorPresence) => void) {
  const configured = Boolean(getEnv().doorDeviceToken);
  const sub = new IORedis(getEnv().redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(1000 * times, 8000),
  });
  void sub.subscribe(DOOR_PRESENCE_CHANNEL);
  sub.on("message", (_channel, raw) => {
    try {
      const parsed = normalize(JSON.parse(raw), configured);
      if (parsed) onEvent(parsed);
    } catch {
      /* ignore bad payloads */
    }
  });
  return () => {
    void sub.unsubscribe(DOOR_PRESENCE_CHANNEL);
    sub.disconnect();
  };
}
