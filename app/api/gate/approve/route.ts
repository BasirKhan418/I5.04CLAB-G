import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";
import { publishGateEvent } from "@/lib/realtime";

const bodySchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "deny"]),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Pick a request to approve or deny");
  }

  await connectDB();
  const log = await AccessLog.findById(parsed.data.id);
  if (!log || log.kind !== "visitor") {
    return jsonError("Request not found", 404);
  }
  if (log.status !== "pending") {
    return jsonOk({
      id: String(log._id),
      status: log.status,
      already: true,
    });
  }

  log.status = parsed.data.action === "approve" ? "approved" : "denied";
  log.approvedBy = new mongoose.Types.ObjectId(auth.session.sub);
  log.approvedAt = new Date();
  if (parsed.data.action === "approve") {
    log.direction = "in";
  }
  await log.save();
  await publishGateEvent({
    type: "request",
    id: String(log._id),
    status: log.status,
  });
  await publishGateEvent({ type: "pending" });

  return jsonOk({
    id: String(log._id),
    status: log.status,
    already: false,
  });
}
