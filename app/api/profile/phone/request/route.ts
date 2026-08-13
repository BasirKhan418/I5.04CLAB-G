import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { issueOtp } from "@/lib/otp";
import { sendPhoneChangeEmail } from "@/lib/mail";
import { sendText } from "@/lib/openwa";
import { normalizePhone, toChatId } from "@/lib/phone";
import { User } from "@/models/User";
import { EMAIL_SIGN_OFF, LAB_SHORT } from "@/lib/constants";

const bodySchema = z.object({
  phone: z.string(),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!phone) {
    return jsonError("Enter a 10-digit Indian mobile number");
  }

  await connectDB();
  const taken = await User.findOne({
    phone,
    _id: { $ne: auth.session.sub },
  });
  if (taken) {
    return jsonError("That number is already on the roster");
  }

  const issued = await issueOtp("phone", phone);
  if (!issued.ok) {
    return jsonError(issued.error, 429);
  }

  const user = await User.findById(auth.session.sub);
  if (user?.email) {
    await sendPhoneChangeEmail(user.email, issued.otp);
  }

  try {
    await sendText(
      toChatId(phone),
      `${LAB_SHORT} number check: your code is ${issued.otp}.\n${EMAIL_SIGN_OFF}`
    );
  } catch (error) {
    console.error("WhatsApp test OTP failed", error);
  }

  return jsonOk({ sent: true, phone });
}
