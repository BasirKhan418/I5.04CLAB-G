import IORedis from "ioredis";
import { GATE_CHANNEL } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import type { GateEvent } from "@/lib/gate-events";

export async function publishGateEvent(event: Exclude<GateEvent, { type: "hello" }>) {
  await getRedis().publish(GATE_CHANNEL, JSON.stringify(event));
}

export function subscribeGateEvents(onEvent: (event: GateEvent) => void) {
  const sub = new IORedis(getEnv().redisUrl, {
    maxRetriesPerRequest: null,
  });
  void sub.subscribe(GATE_CHANNEL);
  sub.on("message", (_channel, raw) => {
    try {
      onEvent(JSON.parse(raw) as GateEvent);
    } catch {
      /* ignore bad payloads */
    }
  });
  return () => {
    void sub.unsubscribe(GATE_CHANNEL);
    sub.disconnect();
  };
}
