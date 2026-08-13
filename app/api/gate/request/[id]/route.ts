import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await connectDB();
  const log = await AccessLog.findById(id).select(
    "status displayName kind direction"
  );
  if (!log || log.kind !== "visitor") {
    return jsonError("Request not found", 404);
  }
  return jsonOk({
    id: String(log._id),
    status: log.status,
    name: log.displayName,
    direction: log.direction,
  });
}
