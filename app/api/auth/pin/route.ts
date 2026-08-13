import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { isValidPin, verifyPin } from "@/lib/pin";
import { createSession } from "@/lib/session";
import { User } from "@/models/User";

const bodySchema = z.object({
  email: z.string().email(),
  pin: z.string(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidPin(parsed.data.pin)) {
    return jsonError("Enter email and PIN");
  }

  await connectDB();
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user) {
    return jsonError("No member with that email");
  }

  const match = await verifyPin(parsed.data.pin, user.pinHash);
  if (!match) {
    return jsonError("Wrong PIN");
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
