import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { issueOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/mail";
import { signInOtpText } from "@/lib/notify";
import { sendText } from "@/lib/openwa";
import { toChatId } from "@/lib/phone";
import { User } from "@/models/User";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Enter a valid email");
  }

  await connectDB();
  const email = parsed.data.email.toLowerCase();
  const user = await User.findOne({ email });
  if (!user) {
    return jsonError("No member with that email");
  }

  const issued = await issueOtp("email", email);
  if (!issued.ok) {
    return jsonError(issued.error, 429);
  }

  let emailed = false;
  let whatsapp = false;
  const failures: string[] = [];

  try {
    await sendOtpEmail(email, issued.otp, "sign in or allow gate entry");
    emailed = true;
  } catch (error) {
    console.error("Sign-in OTP email failed", error);
    failures.push("email");
  }

  if (user.phone) {
    try {
      await sendText(toChatId(user.phone), signInOtpText(issued.otp, user.name));
      whatsapp = true;
    } catch (error) {
      console.error("Sign-in OTP WhatsApp failed", error);
      failures.push("whatsapp");
    }
  }

  if (!emailed && !whatsapp) {
    return jsonError(
      failures.includes("whatsapp")
        ? "Could not send the code to email or WhatsApp"
        : "Could not send the email code"
    );
  }

  return jsonOk({
    sent: true,
    email: emailed,
    whatsapp,
  });
}
