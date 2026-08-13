import { connectDB } from "@/lib/db";
import { jsonOk, requireSession } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";
import { presignGet } from "@/lib/s3";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  await connectDB();
  const logs = await AccessLog.find({
    kind: "visitor",
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .limit(40);

  const data = await Promise.all(
    logs.map(async (log) => ({
      id: String(log._id),
      displayName: log.displayName,
      reason: log.reason,
      createdAt: log.createdAt,
      faceUrl: log.faceKey ? await presignGet(log.faceKey, 3600) : null,
      voiceUrl: log.voiceKey ? await presignGet(log.voiceKey, 3600) : null,
    }))
  );

  return jsonOk(data);
}
