import { connectDB } from "@/lib/db";
import { jsonOk } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";

export async function GET() {
  await connectDB();
  const logs = await AccessLog.find()
    .sort({ createdAt: -1 })
    .limit(12)
    .select("kind displayName direction method createdAt reason")
    .lean();

  return jsonOk(
    logs.map((log) => ({
      id: String(log._id),
      kind: log.kind,
      displayName: log.displayName,
      direction: log.direction,
      method: log.method,
      reason: log.reason,
      createdAt: log.createdAt,
    }))
  );
}
