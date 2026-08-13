import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { issueOtp } from "@/lib/otp";
import { sendPhoneChangeEmail } from "@/lib/mail";
import { phoneVerifyText } from "@/lib/notify";
import { sendText } from "@/lib/openwa";
import { normalizePhone, toChatId } from "@/lib/phone";
import { User } from "@/models/User";

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

  const user = await User.findById(auth.session.sub);
  if (user?.phone === phone) {
    return jsonError("That WhatsApp is already on your profile");
  }

  const issued = await issueOtp("phone", phone);
  if (!issued.ok) {
    return jsonError(issued.error, 429);
  }

  try {
    await sendText(toChatId(phone), phoneVerifyText(issued.otp));
  } catch (error) {
    console.error("WhatsApp number OTP failed", error);
    return jsonError(
      "Could not send the WhatsApp code. Check the number has WhatsApp, and that Infrastructure is Ready."
    );
  }

  if (user?.email) {
    try {
      await sendPhoneChangeEmail(user.email, issued.otp);
    } catch (error) {
      console.error("Phone OTP email failed", error);
    }
  }

  return jsonOk({ sent: true, phone });
}
