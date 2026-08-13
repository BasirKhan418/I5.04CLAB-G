import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { enqueueGateNotify } from "@/lib/queue";
import { labChatIds, visitorCaption } from "@/lib/notify";
import { uploadBuffer } from "@/lib/s3";
import { extFromType, fileToBuffer } from "@/lib/media";
import { AccessLog } from "@/models/AccessLog";
import { DEFAULT_VISITOR_NAME } from "@/lib/constants";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return jsonError("Invalid form");
  }

  const name =
    String(form.get("name") ?? "").trim() || DEFAULT_VISITOR_NAME;
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
    voiceKey = await uploadBuffer({
      body: await fileToBuffer(voice),
      contentType: voice.type || "audio/webm",
      folder: "voice",
      ext: extFromType(voice.type, "webm"),
    });
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

  const chatIds = await labChatIds();
  await enqueueGateNotify({
    logId: String(log._id),
    caption: visitorCaption(name, reason),
    imageKey: faceKey,
    voiceKey: voiceKey,
    chatIds,
  });

  return jsonOk({
    id: String(log._id),
    name,
    at: log.createdAt,
    notified: chatIds.length,
    status: "pending",
  });
}
