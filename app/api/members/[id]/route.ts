import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  if (id === auth.session.sub) {
    return jsonError("You cannot remove yourself");
  }

  await connectDB();
  const user = await User.findById(id);
  if (!user) {
    return jsonError("Member not found", 404);
  }
  if (user.role === "superadmin") {
    return jsonError("Cannot remove the superadmin");
  }

  await User.findByIdAndDelete(id);
  return jsonOk({ removed: true });
}
