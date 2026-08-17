import { Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { DOOR_OPEN_QUEUE, DOOR_OPEN_TTL_MS } from "@/lib/constants";
import { getLiveDoorPresence } from "@/lib/door-presence";
import { publishDoorOpen, type DoorOpenReason } from "@/lib/door";
import { getEnv } from "@/lib/env";

export type DoorOpenJob = {
  reason: DoorOpenReason;
  at: string;
};

export type DoorDelivery = {
  status: "sent" | "queued";
  online: boolean;
  expiresInMs?: number;
};

const globalForDoorQueue = globalThis as unknown as {
  doorOpenQueue?: Queue<DoorOpenJob>;
  doorQueueStarted?: boolean;
};

function queueConnection() {
  return new IORedis(getEnv().redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function getDoorOpenQueue() {
  if (globalForDoorQueue.doorOpenQueue) {
    return globalForDoorQueue.doorOpenQueue;
  }
  const queue = new Queue<DoorOpenJob>(DOOR_OPEN_QUEUE, {
    connection: queueConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 40,
      removeOnFail: 40,
    },
  });
  globalForDoorQueue.doorOpenQueue = queue;
  return queue;
}

function jobAgeMs(job: Job<DoorOpenJob>) {
  return Date.now() - (job.timestamp || Date.now());
}

function eventAgeMs(at: string) {
  const then = new Date(at).getTime();
  if (!Number.isFinite(then)) return DOOR_OPEN_TTL_MS + 1;
  return Date.now() - then;
}

export async function enqueueDoorOpen(
  reason: DoorOpenReason,
  at = new Date().toISOString()
) {
  if (eventAgeMs(at) > DOOR_OPEN_TTL_MS) return null;
  try {
    return await getDoorOpenQueue().add(
      "open",
      { reason, at },
      { jobId: `open-${reason}-${at}` }
    );
  } catch {
    return null;
  }
}

export async function dropStaleDoorJobs() {
  const waiting = await getDoorOpenQueue().getJobs([
    "waiting",
    "delayed",
    "failed",
  ]);
  await Promise.all(
    waiting
      .filter((job) => jobAgeMs(job) > DOOR_OPEN_TTL_MS)
      .map((job) => job.remove().catch(() => undefined))
  );
}

export async function flushQueuedDoorOpens() {
  await dropStaleDoorJobs();
  const jobs = await getDoorOpenQueue().getJobs(["waiting", "delayed", "failed"]);
  let sent = 0;
  for (const job of jobs) {
    if (jobAgeMs(job) > DOOR_OPEN_TTL_MS) {
      await job.remove().catch(() => undefined);
      continue;
    }
    await publishDoorOpen(job.data.reason);
    await job.remove().catch(() => undefined);
    sent += 1;
  }
  return sent;
}

export async function requestDoorOpen(
  reason: DoorOpenReason
): Promise<DoorDelivery> {
  const presence = await getLiveDoorPresence();
  if (presence.online) {
    await publishDoorOpen(reason);
    return { status: "sent", online: true };
  }

  await enqueueDoorOpen(reason);
  return {
    status: "queued",
    online: false,
    expiresInMs: DOOR_OPEN_TTL_MS,
  };
}

export function startDoorQueueRuntime() {
  if (globalForDoorQueue.doorQueueStarted) return;
  globalForDoorQueue.doorQueueStarted = true;
  setInterval(() => {
    void dropStaleDoorJobs();
  }, 15_000);
}
