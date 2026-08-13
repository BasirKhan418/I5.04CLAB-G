import { connectDB } from "@/lib/db";
import { jsonOk, requireSession } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";
import { presignGet } from "@/lib/s3";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "80"), 200);
  const kindParam = searchParams.get("kind");
  const kind =
    kindParam === "member" || kindParam === "visitor" ? kindParam : undefined;

  await connectDB();
  const logs = await AccessLog.find(kind ? { kind } : {})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const data = await Promise.all(
    logs.map(async (log) => ({
      id: String(log._id),
      kind: log.kind,
      displayName: log.displayName,
      reason: log.reason,
      direction: log.direction,
      method: log.method,
      createdAt: log.createdAt,
      notifiedAt: log.notifiedAt,
      faceUrl: log.faceKey ? await presignGet(log.faceKey, 3600) : null,
      voiceUrl: log.voiceKey ? await presignGet(log.voiceKey, 3600) : null,
    }))
  );

  return jsonOk(data);
}
