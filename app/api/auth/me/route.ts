import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { User } from "@/models/User";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  await connectDB();
  const user = await User.findById(auth.session.sub);
  if (!user) {
    return jsonError("Account missing", 401);
  }

  return jsonOk({
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    mustChangePin: user.mustChangePin,
  });
}
