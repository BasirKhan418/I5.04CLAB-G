import IORedis from "ioredis";
import { getEnv } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis?: IORedis;
};

export function getRedis(): IORedis {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const redis = new IORedis(getEnv().redisUrl, {
    maxRetriesPerRequest: null,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = redis;
  }

  return redis;
}
