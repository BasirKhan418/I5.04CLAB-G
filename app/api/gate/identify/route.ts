import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { consumeOtp } from "@/lib/otp";
import { isValidPin, verifyPin } from "@/lib/pin";
import { createSession } from "@/lib/session";
import { User } from "@/models/User";
import { AccessLog } from "@/models/AccessLog";
import { isCurrentlyIn } from "@/lib/hours";
import { presignGet } from "@/lib/s3";

const bodySchema = z.object({
  email: z.string().email(),
  pin: z.string().optional(),
  otp: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Enter your lab email");
  }

  await connectDB();
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user) {
    return jsonError("No member with that email");
  }

  if (parsed.data.otp) {
    const ok = await consumeOtp("email", user.email, parsed.data.otp);
    if (!ok) {
      return jsonError("Invalid or expired code");
    }
  } else if (parsed.data.pin && isValidPin(parsed.data.pin)) {
    const match = await verifyPin(parsed.data.pin, user.pinHash);
    if (!match) {
      return jsonError("Wrong PIN");
    }
  } else {
    return jsonError("Enter your PIN or email OTP");
  }

  await createSession({
    sub: String(user._id),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const events = await AccessLog.find({
    kind: "member",
    userId: user._id,
  }).select("direction createdAt");

  return jsonOk({
    id: String(user._id),
    name: user.name,
    email: user.email,
    faceUrl: user.faceKey ? await presignGet(user.faceKey, 3600) : null,
    inside: isCurrentlyIn(
      events.map((log) => ({
        direction: log.direction as "in" | "out",
        createdAt: log.createdAt,
      }))
    ),
    enteredAt: (() => {
      const sorted = [...events].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      let lastIn: Date | null = null;
      for (const log of sorted) {
        if (log.direction === "in") lastIn = log.createdAt;
        if (log.direction === "out") lastIn = null;
      }
      return lastIn ? lastIn.toISOString() : null;
    })(),
  });
}
