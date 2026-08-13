import { DOOR_CHANNEL, DOOR_OPEN_MS } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";

export type DoorOpenReason =
  | "visitor-approve"
  | "member-in"
  | "member-out"
  | "manual";

export type DoorOpenEvent = {
  type: "open";
  holdMs: number;
  reason: DoorOpenReason;
  at: string;
};

export async function publishDoorOpen(reason: DoorOpenReason) {
  const holdMs = Number.isFinite(getEnv().doorOpenMs)
    ? getEnv().doorOpenMs
    : DOOR_OPEN_MS;
  const event: DoorOpenEvent = {
    type: "open",
    holdMs: holdMs > 0 ? holdMs : DOOR_OPEN_MS,
    reason,
    at: new Date().toISOString(),
  };
  await getRedis().publish(DOOR_CHANNEL, JSON.stringify(event));
}
