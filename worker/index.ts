import "dotenv/config";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import { QUEUE_NAME } from "../lib/constants";
import { getEnv } from "../lib/env";
import { getOpenwaConfig } from "../lib/openwa-config";
import {
  visitorAlertText,
  visitorImageCaption,
  visitorTemplateVars,
} from "../lib/notify";
import { sendImage, sendTemplate, sendText, sendVoice } from "../lib/openwa";
import { publicAllowUrl } from "../lib/allow-link";
import { presignGet } from "../lib/s3";
import type { GateNotifyJob, NotifySent } from "../lib/queue";
import { AccessLog } from "../models/AccessLog";

function uniqueRecipients(recipients: GateNotifyJob["recipients"]) {
  const seen = new Set<string>();
  return (recipients ?? []).filter((recipient) => {
    if (seen.has(recipient.chatId)) return false;
    seen.add(recipient.chatId);
    return true;
  });
}

async function sendAlert(
  chatId: string,
  memberName: string,
  visitorName: string,
  reason: string | null
) {
  const config = await getOpenwaConfig();
  const text = visitorAlertText(memberName, visitorName, reason);
  try {
    if (config.templateId) {
      await sendTemplate(
        chatId,
        visitorTemplateVars(memberName, visitorName, reason)
      );
      return;
    }
  } catch (error) {
    console.error("template send failed, using text", error);
  }
  await sendText(chatId, text);
}

async function main() {
  const env = getEnv();
  await mongoose.connect(env.mongoUri);

  const connection = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<GateNotifyJob>(
    QUEUE_NAME,
    async (job: Job<GateNotifyJob>) => {
      const { logId, visitorName, reason, imageKey, voiceKey } = job.data;
      const recipients = uniqueRecipients(job.data.recipients);
      if (recipients.length === 0) return;

      const sent: Record<string, NotifySent> = { ...(job.data.sent ?? {}) };
      let write = Promise.resolve();
      const persist = (chatId: string, step: keyof NotifySent) => {
        write = write.then(async () => {
          sent[chatId] = { ...sent[chatId], [step]: true };
          await job.updateData({ ...job.data, sent });
        });
        return write;
      };
      const done = (chatId: string, step: keyof NotifySent) =>
        Boolean(sent[chatId]?.[step]);

      const imageUrl = imageKey ? await presignGet(imageKey) : null;
      const voiceUrl = voiceKey ? await presignGet(voiceKey) : null;
      const reasonOnText = imageUrl ? null : reason;
      const imageCaption = visitorImageCaption(reason);

      const failures: unknown[] = [];

      await Promise.all(
        recipients.map(async (recipient) => {
          if (done(recipient.chatId, "text")) return;
          try {
            await sendAlert(
              recipient.chatId,
              recipient.name,
              visitorName,
              reasonOnText
            );
            await persist(recipient.chatId, "text");
          } catch (error) {
            console.error(`text failed for ${recipient.chatId}`, error);
            failures.push(error);
          }
        })
      );

      if (imageUrl) {
        await Promise.all(
          recipients.map(async (recipient) => {
            if (done(recipient.chatId, "image")) return;
            try {
              await sendImage(recipient.chatId, imageUrl, imageCaption);
              await persist(recipient.chatId, "image");
            } catch (error) {
              console.error(`image failed for ${recipient.chatId}`, error);
              failures.push(error);
            }
          })
        );
      }

      if (voiceUrl) {
        await Promise.all(
          recipients.map(async (recipient) => {
            if (done(recipient.chatId, "voice")) return;
            try {
              await sendVoice(recipient.chatId, voiceUrl);
              await persist(recipient.chatId, "voice");
            } catch (error) {
              console.error(`voice failed for ${recipient.chatId}`, error);
            }
          })
        );
      }

      const allowUrl = publicAllowUrl(logId);
      if (allowUrl) {
        const linkText = `Tap to allow ${visitorName}:\n${allowUrl}`;
        await Promise.all(
          recipients.map(async (recipient) => {
            if (done(recipient.chatId, "link")) return;
            try {
              await sendText(recipient.chatId, linkText);
              await persist(recipient.chatId, "link");
            } catch (error) {
              console.error(`link failed for ${recipient.chatId}`, error);
              failures.push(error);
            }
          })
        );
      }

      if (failures.length) {
        throw failures[0];
      }

      await AccessLog.findByIdAndUpdate(logId, { notifiedAt: new Date() });
    },
    {
      connection,
      concurrency: 1,
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
