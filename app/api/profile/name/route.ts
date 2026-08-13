import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { createSession } from "@/lib/session";
import { User } from "@/models/User";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Enter a name (up to 80 characters)");
  }

  const name = parsed.data.name.replace(/\s+/g, " ");

  await connectDB();
  const user = await User.findById(auth.session.sub);
  if (!user) {
    return jsonError("Account missing", 401);
  }

  user.name = name;
  await user.save();

  await createSession({
    sub: String(user._id),
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return jsonOk({ name: user.name });
}
