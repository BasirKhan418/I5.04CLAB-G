import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis";
import { QUEUE_NAME } from "@/lib/constants";

export type GateNotifyRecipient = {
  chatId: string;
  name: string;
};

export type NotifySent = {
  text?: boolean;
  image?: boolean;
  voice?: boolean;
  link?: boolean;
};

export type GateNotifyJob = {
  logId: string;
  visitorName: string;
  reason: string | null;
  imageKey?: string | null;
  voiceKey?: string | null;
  voiceSeconds?: number;
  recipients: GateNotifyRecipient[];
  sent?: Record<string, NotifySent>;
};

const globalForQueue = globalThis as unknown as {
  notifyQueue?: Queue<GateNotifyJob>;
};

export function getNotifyQueue() {
  if (globalForQueue.notifyQueue) {
    return globalForQueue.notifyQueue;
  }
  const queue = new Queue<GateNotifyJob>(QUEUE_NAME, {
    connection: getRedis(),
  });
  if (process.env.NODE_ENV !== "production") {
    globalForQueue.notifyQueue = queue;
  }
  return queue;
}

export async function enqueueGateNotify(data: GateNotifyJob) {
  if (data.recipients.length === 0) {
    return null;
  }
  return getNotifyQueue().add("notify", data, {
    jobId: `notify-${data.logId}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 200,
  });
}
