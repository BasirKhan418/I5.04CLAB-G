import { connectDB } from "@/lib/db";
import { jsonOk, requireSession } from "@/lib/api";
import { User } from "@/models/User";
import { AccessLog } from "@/models/AccessLog";
import {
  computeHoursMs,
  formatDuration,
  isCurrentlyIn,
  startOfDayIST,
} from "@/lib/hours";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  await connectDB();
  const since = startOfDayIST();
  const [users, logs, recent] = await Promise.all([
    User.find().sort({ name: 1 }),
    AccessLog.find({ kind: "member" }).sort({ createdAt: 1 }),
    AccessLog.find().sort({ createdAt: -1 }).limit(8),
  ]);

  const members = users.map((user) => {
    const events = logs
      .filter((log) => String(log.userId) === String(user._id))
      .map((log) => ({
        direction: log.direction as "in" | "out",
        createdAt: log.createdAt,
      }));
    const today = events.filter((e) => e.createdAt >= since);
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      inside: isCurrentlyIn(events),
      hoursToday: formatDuration(computeHoursMs(today)),
      hoursAll: formatDuration(computeHoursMs(events)),
    };
  });

  const insideCount = members.filter((m) => m.inside).length;
  const visitorToday = await AccessLog.countDocuments({
    kind: "visitor",
    createdAt: { $gte: since },
  });

  return jsonOk({
    insideCount,
    memberCount: members.length,
    visitorToday,
    members,
    recent: recent.map((log) => ({
      id: String(log._id),
      kind: log.kind,
      displayName: log.displayName,
      direction: log.direction,
      method: log.method,
      reason: log.reason,
      createdAt: log.createdAt,
    })),
  });
}
