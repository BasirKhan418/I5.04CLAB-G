import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { consumeOtp } from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";

const bodySchema = z.object({
  phone: z.string(),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Enter the new number and 6-digit code");
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return jsonError("Enter a 10-digit Indian mobile number");
  }

  const ok = await consumeOtp("phone", phone, parsed.data.otp);
  if (!ok) {
    return jsonError("Invalid or expired code");
  }

  await connectDB();
  const taken = await User.findOne({
    phone,
    _id: { $ne: auth.session.sub },
  });
  if (taken) {
    return jsonError("That number is already on the roster");
  }

  await User.findByIdAndUpdate(auth.session.sub, {
    phone,
    notifyWhatsApp: true,
  });
  return jsonOk({ phone });
}
