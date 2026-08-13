import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { consumeOtp } from "@/lib/otp";
import { isValidPin, verifyPin } from "@/lib/pin";
import { getSession } from "@/lib/session";
import { nextMemberDirection } from "@/lib/access";
import { User } from "@/models/User";
import { AccessLog } from "@/models/AccessLog";
import { publishDoorOpen } from "@/lib/door";

const bodySchema = z.object({
  email: z.string().email().optional(),
  pin: z.string().optional(),
  otp: z.string().optional(),
  direction: z.enum(["in", "out"]).optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid request");
  }

  await connectDB();
  const session = await getSession();
  let user = session ? await User.findById(session.sub) : null;
  let method: "pin" | "otp" = "pin";

  if (!user) {
    if (!parsed.data.email) {
      return jsonError("Sign in or enter your lab email");
    }
    user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) {
      return jsonError("No member with that email");
    }

    if (parsed.data.otp) {
      const ok = await consumeOtp("email", user.email, parsed.data.otp);
      if (!ok) {
        return jsonError("Invalid or expired code");
      }
      method = "otp";
    } else if (parsed.data.pin && isValidPin(parsed.data.pin)) {
      const match = await verifyPin(parsed.data.pin, user.pinHash);
      if (!match) {
        return jsonError("Wrong PIN");
      }
      method = "pin";
    } else {
      return jsonError("Enter your PIN or email OTP");
    }
  } else if (parsed.data.otp) {
    method = "otp";
  }

  const next = await nextMemberDirection(user._id);
  const direction = parsed.data.direction ?? next;

  if (direction === "in" && next === "out") {
    const lastIn = await AccessLog.findOne({
      userId: user._id,
      kind: "member",
      direction: "in",
    }).sort({ createdAt: -1 });
    await publishDoorOpen("member-in");
    return jsonOk({
      direction: "in",
      name: user.name,
      already: true,
      at: lastIn?.createdAt ?? new Date(),
    });
  }
  if (direction === "out" && next === "in") {
    await publishDoorOpen("member-out");
    return jsonOk({
      direction: "out",
      name: user.name,
      already: true,
    });
  }

  const log = await AccessLog.create({
    kind: "member",
    userId: user._id,
    displayName: user.name,
    direction,
    method,
    status: "approved",
  });

  await publishDoorOpen(direction === "in" ? "member-in" : "member-out");

  return jsonOk({
    direction,
    name: user.name,
    already: false,
    at: log.createdAt,
  });
}
