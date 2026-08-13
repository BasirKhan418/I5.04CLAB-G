import { connectDB } from "@/lib/db";
import { jsonOk, requireSession } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "80"), 200);
  const kindParam = searchParams.get("kind");
  const kind =
    kindParam === "member" ||
    kindParam === "visitor" ||
    kindParam === "utility"
      ? kindParam
      : undefined;

  await connectDB();
  const logs = await AccessLog.find(kind ? { kind } : {})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const data = logs.map((log) => ({
    id: String(log._id),
    kind: log.kind,
    displayName: log.displayName,
    reason: log.reason,
    direction: log.direction,
    method: log.method,
    createdAt: log.createdAt,
    notifiedAt: log.notifiedAt,
    faceUrl: log.faceKey ? `/api/gate/media/${log._id}?kind=face` : null,
    voiceUrl: log.voiceKey ? `/api/gate/media/${log._id}?kind=voice` : null,
  }));

  return jsonOk(data);
}
