import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { publishDoorOpen } from "@/lib/door";
import { publishGateEvent } from "@/lib/realtime";
import { AccessLog } from "@/models/AccessLog";

export type GateAction = "approve" | "deny";

const LINK_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export async function decideVisitorRequest(opts: {
  id: string;
  action: GateAction;
  actorId?: string | null;
}) {
  await connectDB();
  const log = await AccessLog.findById(opts.id);
  if (!log || log.kind !== "visitor") {
    return { ok: false as const, error: "Request not found", status: 404 };
  }
  if (log.status !== "pending") {
    return {
      ok: true as const,
      already: true,
      id: String(log._id),
      status: log.status,
      name: log.displayName,
    };
  }

  log.status = opts.action === "approve" ? "approved" : "denied";
  log.approvedAt = new Date();
  if (opts.actorId) {
    log.approvedBy = new mongoose.Types.ObjectId(opts.actorId);
  }
  if (opts.action === "approve") {
    log.direction = "in";
  }
  await log.save();

  await publishGateEvent({
    type: "request",
    id: String(log._id),
    status: log.status,
  });
  await publishGateEvent({ type: "pending" });
  if (log.status === "approved") {
    await publishDoorOpen("visitor-approve");
  }

  return {
    ok: true as const,
    already: false,
    id: String(log._id),
    status: log.status,
    name: log.displayName,
  };
}

export async function publicDoorAllow(id: string) {
  await connectDB();
  const log = await AccessLog.findById(id);
  if (!log || log.kind !== "visitor") {
    return { ok: false as const, error: "Link is not valid" };
  }
  const age = Date.now() - new Date(log.createdAt).getTime();
  if (age > LINK_MAX_AGE_MS) {
    return { ok: false as const, error: "This link has expired" };
  }

  if (log.status === "approved") {
    await publishDoorOpen("visitor-approve");
    return {
      ok: true as const,
      already: true,
      pulsed: true,
      id: String(log._id),
      status: log.status,
      name: log.displayName,
    };
  }

  log.status = "approved";
  log.approvedAt = new Date();
  log.direction = "in";
  await log.save();
  await publishGateEvent({
    type: "request",
    id: String(log._id),
    status: "approved",
  });
  await publishGateEvent({ type: "pending" });
  await publishDoorOpen("visitor-approve");
  return {
    ok: true as const,
    already: false,
    pulsed: true,
    id: String(log._id),
    status: "approved" as const,
    name: log.displayName,
  };
}

export async function publicDoorDeny(id: string) {
  return decideVisitorRequest({ id, action: "deny" });
}
