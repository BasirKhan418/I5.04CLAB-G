import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { hashPin, isValidPin, verifyPin } from "@/lib/pin";
import { User } from "@/models/User";

const bodySchema = z.object({
  currentPin: z.string().optional(),
  newPin: z.string(),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidPin(parsed.data.newPin)) {
    return jsonError("PIN must be 4–8 digits");
  }

  await connectDB();
  const user = await User.findById(auth.session.sub);
  if (!user) {
    return jsonError("Account missing", 401);
  }

  if (!user.mustChangePin) {
    if (!parsed.data.currentPin || !(await verifyPin(parsed.data.currentPin, user.pinHash))) {
      return jsonError("Current PIN is wrong");
    }
  }

  user.pinHash = await hashPin(parsed.data.newPin);
  user.mustChangePin = false;
  await user.save();
  return jsonOk({ changed: true });
}
