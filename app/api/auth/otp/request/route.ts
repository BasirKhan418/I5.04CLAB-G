import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { issueOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/mail";
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

  await sendOtpEmail(email, issued.otp, "sign in or allow gate entry");
  return jsonOk({ sent: true });
}
