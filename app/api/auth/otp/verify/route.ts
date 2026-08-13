import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { consumeOtp } from "@/lib/otp";
import { createSession } from "@/lib/session";
import { User } from "@/models/User";

const bodySchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Enter email and the 6-digit code");
  }

  await connectDB();
  const email = parsed.data.email.toLowerCase();
  const user = await User.findOne({ email });
  if (!user) {
    return jsonError("No member with that email");
  }

  const ok = await consumeOtp("email", email, parsed.data.otp);
  if (!ok) {
    return jsonError("Invalid or expired code");
  }

  await createSession({
    sub: String(user._id),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return jsonOk({
    mustChangePin: user.mustChangePin,
    name: user.name,
    role: user.role,
  });
}
