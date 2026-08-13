import { AccessLog } from "@/models/AccessLog";
import type { Types } from "mongoose";

export async function nextMemberDirection(
  userId: Types.ObjectId | string
): Promise<"in" | "out"> {
  const lastIn = await AccessLog.findOne({
    userId,
    kind: "member",
    direction: "in",
  }).sort({ createdAt: -1 });

  if (!lastIn) {
    return "in";
  }

  const matchingOut = await AccessLog.findOne({
    userId,
    kind: "member",
    direction: "out",
    createdAt: { $gt: lastIn.createdAt },
  });

  return matchingOut ? "in" : "out";
}
