import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { publishDoorOpen } from "@/lib/door";
import { AccessLog } from "@/models/AccessLog";
import { User } from "@/models/User";

const bodySchema = z.object({
  reason: z.string().trim().min(2, "Add a short reason").max(200),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Add a reason before opening the door");
  }

  await connectDB();
  const user = await User.findById(auth.session.sub);
  if (!user) {
    return jsonError("Account missing", 401);
  }

  const log = await AccessLog.create({
    kind: "utility",
    userId: user._id,
    displayName: user.name,
    reason: parsed.data.reason,
    direction: "in",
    method: "manual",
    status: "approved",
    approvedBy: user._id,
    approvedAt: new Date(),
  });

  await publishDoorOpen("manual");

  return jsonOk({
    id: String(log._id),
    reason: log.reason,
    at: log.createdAt,
  });
}
