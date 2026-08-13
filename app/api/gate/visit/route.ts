import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { enqueueGateNotify } from "@/lib/queue";
import { labRecipients, visitorName } from "@/lib/notify";
import { uploadBuffer } from "@/lib/s3";
import { extFromType, fileToBuffer } from "@/lib/media";
import { toOggOpus } from "@/lib/to-ogg";
import { AccessLog } from "@/models/AccessLog";
import { publishGateEvent } from "@/lib/realtime";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return jsonError("Invalid form");
  }

  const name = visitorName(String(form.get("name") ?? ""));
  const reason = String(form.get("reason") ?? "").trim() || null;
  const face = form.get("face");
  const voice = form.get("voice");

  let faceKey: string | null = null;
  let voiceKey: string | null = null;

  if (face instanceof File && face.size > 0) {
    if (face.size > 5 * 1024 * 1024) {
      return jsonError("Face image must be under 5MB");
    }
    faceKey = await uploadBuffer({
      body: await fileToBuffer(face),
      contentType: face.type || "image/jpeg",
      folder: "face",
      ext: extFromType(face.type, "jpg"),
    });
  }

  if (voice instanceof File && voice.size > 0) {
    if (voice.size > 8 * 1024 * 1024) {
      return jsonError("Voice note must be under 8MB");
    }
    const raw = await fileToBuffer(voice);
    const ext = extFromType(voice.type, "webm");
    try {
      const ogg = await toOggOpus(raw, ext);
      voiceKey = await uploadBuffer({
        body: ogg,
        contentType: "audio/ogg",
        folder: "voice",
        ext: "ogg",
      });
    } catch (error) {
      console.error("voice convert failed", error);
      return jsonError("Could not process voice note");
    }
  }

  await connectDB();
  const log = await AccessLog.create({
    kind: "visitor",
    displayName: name,
    reason,
    direction: "in",
    method: "visitor",
    status: "pending",
    faceKey,
    voiceKey,
  });

  const recipients = await labRecipients();
  await enqueueGateNotify({
    logId: String(log._id),
    visitorName: name,
    reason,
    imageKey: faceKey,
    voiceKey,
    recipients,
  });
  await publishGateEvent({
    type: "request",
    id: String(log._id),
    status: "pending",
  });
  await publishGateEvent({ type: "pending" });

  return jsonOk({
    id: String(log._id),
    name,
    at: log.createdAt,
    notified: recipients.length,
    status: "pending",
  });
}
