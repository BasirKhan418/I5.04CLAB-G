import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import { QUEUE_NAME } from "../lib/constants";
import { getEnv } from "../lib/env";
import { sendImage, sendText, sendVoice } from "../lib/openwa";
import { presignGet } from "../lib/s3";
import type { GateNotifyJob } from "../lib/queue";
import { AccessLog } from "../models/AccessLog";

async function main() {
  const env = getEnv();
  await mongoose.connect(env.mongoUri);

  const connection = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<GateNotifyJob>(
    QUEUE_NAME,
    async (job) => {
      const { logId, caption, imageKey, voiceKey, chatIds } = job.data;
      if (chatIds.length === 0) {
        return;
      }

      const imageUrl = imageKey ? await presignGet(imageKey) : null;
      const voiceUrl = voiceKey ? await presignGet(voiceKey) : null;

      const primary = chatIds.map(async (chatId) => {
        if (imageUrl) {
          await sendImage(chatId, imageUrl, caption);
          return;
        }
        await sendText(chatId, caption);
      });
      await Promise.all(primary);

      if (voiceUrl) {
        await Promise.all(chatIds.map((chatId) => sendVoice(chatId, voiceUrl)));
      }

      await AccessLog.findByIdAndUpdate(logId, { notifiedAt: new Date() });
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.info(`gate-notify ${job.id} sent`);
  });
  worker.on("failed", (job, err) => {
    console.error(`gate-notify ${job?.id} failed`, err);
  });

  console.info("I5.04C Lab notify worker listening");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
