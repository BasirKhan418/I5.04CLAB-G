import { connectDB } from "@/lib/db";
import { jsonOk, requireSession } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";

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

  const data = logs.map((log) => ({
    id: String(log._id),
    displayName: log.displayName,
    reason: log.reason,
    createdAt: log.createdAt,
    faceUrl: log.faceKey ? `/api/gate/media/${log._id}?kind=face` : null,
    voiceUrl: log.voiceKey ? `/api/gate/media/${log._id}?kind=voice` : null,
  }));

  return jsonOk(data);
}
