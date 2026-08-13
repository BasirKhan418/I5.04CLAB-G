import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import { normalizePhone } from "@/lib/phone";
import { createSession } from "@/lib/session";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["superadmin", "admin", "member"]),
  notifyWhatsApp: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Name, email, and role are required");
  }

  const actorIsSuperadmin = auth.session.role === "superadmin";
  if (parsed.data.role === "superadmin" && !actorIsSuperadmin) {
    return jsonError("Only a superadmin can assign that role");
  }

  const email = parsed.data.email.toLowerCase();
  const phone = parsed.data.phone?.trim()
    ? normalizePhone(parsed.data.phone)
    : null;
  if (parsed.data.phone?.trim() && !phone) {
    return jsonError("Phone must be a 10-digit Indian number");
  }

  await connectDB();
  const user = await User.findById(id);
  if (!user) {
    return jsonError("Member not found", 404);
  }

  if (user.role === "superadmin" && !actorIsSuperadmin) {
    return jsonError("Only a superadmin can edit a superadmin");
  }

  if (parsed.data.role === "superadmin" && user.role !== "superadmin") {
    return jsonError("There can be only one superadmin");
  }

  if (user.role === "superadmin" && parsed.data.role !== "superadmin") {
    const others = await User.countDocuments({
      role: "superadmin",
      _id: { $ne: user._id },
    });
    if (others === 0) {
      return jsonError("Cannot demote the last superadmin");
    }
  }

  const clash = await User.findOne({
    _id: { $ne: user._id },
    $or: [{ email }, ...(phone ? [{ phone }] : [])],
  });
  if (clash) {
    return jsonError("Email or phone already on the roster");
  }

  user.name = parsed.data.name.replace(/\s+/g, " ");
  user.email = email;
  user.phone = phone;
  user.role = parsed.data.role;
  if (typeof parsed.data.notifyWhatsApp === "boolean") {
    user.notifyWhatsApp = parsed.data.notifyWhatsApp;
  }
  await user.save();

  if (id === auth.session.sub) {
    await createSession({
      sub: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name,
    });
  }

  return jsonOk({
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    notifyWhatsApp: user.notifyWhatsApp,
  });
}

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
    if (auth.session.role !== "superadmin") {
      return jsonError("Cannot remove a superadmin");
    }
    const others = await User.countDocuments({
      role: "superadmin",
      _id: { $ne: user._id },
    });
    if (others === 0) {
      return jsonError("Cannot remove the last superadmin");
    }
  }

  await User.findByIdAndDelete(id);
  return jsonOk({ removed: true });
}
