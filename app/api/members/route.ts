import { z } from "zod";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireAdmin, requireSession } from "@/lib/api";
import { sendWelcomePin } from "@/lib/mail";
import { generatePin, hashPin } from "@/lib/pin";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";
import { AccessLog } from "@/models/AccessLog";
import {
  computeHoursMs,
  formatDuration,
  isCurrentlyIn,
  startOfDayIST,
} from "@/lib/hours";

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["admin", "member"]).optional(),
});

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  await connectDB();
  const users = await User.find().sort({ createdAt: 1 });
  const since = startOfDayIST();
  const logs = await AccessLog.find({
    kind: "member",
    userId: { $in: users.map((u) => u._id) },
  }).sort({ createdAt: 1 });

  const data = users.map((user) => {
    const events = logs
      .filter((log) => String(log.userId) === String(user._id))
      .map((log) => ({
        direction: log.direction as "in" | "out",
        createdAt: log.createdAt,
      }));
    const todayEvents = events.filter((e) => e.createdAt >= since);
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      inside: isCurrentlyIn(events),
      hoursToday: formatDuration(computeHoursMs(todayEvents)),
      hoursAll: formatDuration(computeHoursMs(events)),
    };
  });

  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Name and email are required");
  }

  const email = parsed.data.email.toLowerCase();
  const phone = parsed.data.phone?.trim()
    ? normalizePhone(parsed.data.phone)
    : null;
  if (parsed.data.phone?.trim() && !phone) {
    return jsonError("Phone must be a 10-digit Indian number");
  }

  await connectDB();
  const exists = await User.findOne({
    $or: [{ email }, ...(phone ? [{ phone }] : [])],
  });
  if (exists) {
    return jsonError("Email or phone already on the roster");
  }

  const pin = generatePin();
  const user = await User.create({
    name: parsed.data.name.trim(),
    email,
    ...(phone ? { phone } : {}),
    role: parsed.data.role ?? "member",
    pinHash: await hashPin(pin),
    mustChangePin: true,
    notifyWhatsApp: true,
  });

  try {
    await sendWelcomePin(email, user.name, pin);
  } catch (error) {
    console.error("Welcome PIN email failed", error);
    return jsonOk({
      id: String(user._id),
      emailed: false,
      warning: "Member saved, but the PIN email failed. Check SMTP.",
    });
  }

  return jsonOk({ id: String(user._id), emailed: true });
}
