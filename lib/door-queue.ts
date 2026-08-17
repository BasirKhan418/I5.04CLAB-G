import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { DOOR_OPEN_QUEUE, DOOR_OPEN_TTL_MS } from "@/lib/constants";
import { getDoorPresence, subscribeDoorPresence } from "@/lib/door-presence";
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
  doorOpenWorker?: Worker<DoorOpenJob>;
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

async function dropStaleJobs() {
  const queue = getDoorOpenQueue();
  const waiting = await queue.getJobs(["waiting", "delayed", "paused"]);
  await Promise.all(
    waiting
      .filter((job) => jobAgeMs(job) > DOOR_OPEN_TTL_MS)
      .map((job) => job.remove().catch(() => undefined))
  );
}

async function processOpen(job: Job<DoorOpenJob>) {
  if (jobAgeMs(job) > DOOR_OPEN_TTL_MS) {
    return { dropped: true as const };
  }
  const presence = await getDoorPresence();
  if (!presence.online) {
    throw new Error("door offline");
  }
  await publishDoorOpen(job.data.reason);
  return { dropped: false as const };
}

export async function requestDoorOpen(
  reason: DoorOpenReason
): Promise<DoorDelivery> {
  const presence = await getDoorPresence();
  if (presence.online) {
    await publishDoorOpen(reason);
    return { status: "sent", online: true };
  }

  await getDoorOpenQueue().add(
    "open",
    { reason, at: new Date().toISOString() },
    { jobId: `open-${reason}-${Date.now()}` }
  );
  return {
    status: "queued",
    online: false,
    expiresInMs: DOOR_OPEN_TTL_MS,
  };
}

export function startDoorQueueRuntime() {
  if (globalForDoorQueue.doorQueueStarted) return;
  globalForDoorQueue.doorQueueStarted = true;

  const worker = new Worker<DoorOpenJob>(DOOR_OPEN_QUEUE, processOpen, {
    connection: queueConnection(),
    concurrency: 1,
    autorun: false,
  });
  globalForDoorQueue.doorOpenWorker = worker;

  const apply = async (online: boolean) => {
    await dropStaleJobs();
    if (online) {
      if (worker.isPaused()) await worker.resume();
      if (!worker.isRunning()) void worker.run();
      return;
    }
    if (worker.isRunning() && !worker.isPaused()) {
      await worker.pause();
    }
  };

  void getDoorPresence()
    .then((presence) => apply(presence.online))
    .catch(() => apply(false));

  subscribeDoorPresence((presence) => {
    void apply(presence.online);
  });

  setInterval(() => {
    void dropStaleJobs();
  }, 20_000);
}
