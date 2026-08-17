import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import { User } from "@/models/User";
import {
  formatIstTime,
  isAfterWorkEnd,
  istDateKey,
  parseRange,
  WORK_END_LABEL,
  WORK_START_LABEL,
} from "@/lib/hours";
import { buildHoursReport } from "@/lib/reports";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return jsonError("Member not found", 404);
  }

  const { searchParams } = new URL(request.url);
  const { from, to } = parseRange(
    searchParams.get("from"),
    searchParams.get("to")
  );
  const day =
    searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date")!)
      ? searchParams.get("date")!
      : istDateKey();

  await connectDB();
  const user = await User.findById(id);
  if (!user) {
    return jsonError("Member not found", 404);
  }

  const report = await buildHoursReport(from, to, id);
  if ("error" in report) {
    return jsonError(report.error);
  }

  const today = istDateKey();
  const dayPunchesRaw = [...report.punches]
    .reverse()
    .filter((punch) => istDateKey(new Date(punch.createdAt)) === day);
  const dayPunches = dayPunchesRaw.map((punch) => {
    const created = new Date(punch.createdAt);
    const auditOnly = isAfterWorkEnd(created, day);
    return {
      id: punch.id,
      direction: punch.direction,
      method: punch.method,
      createdAt: punch.createdAt,
      time: formatIstTime(created),
      auditOnly,
      note: auditOnly ? "After 5:30 PM · audit only" : null,
    };
  });

  const daySession = report.sessions.find((session) => session.date === day);
  const member = report.members[0];
  const todaySession = report.sessions.find((session) => session.date === today);

  return jsonOk({
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    notifyWhatsApp: user.notifyWhatsApp,
    inside: member?.inside ?? false,
    window: `${WORK_START_LABEL} – ${WORK_END_LABEL}`,
    from: report.from,
    to: report.to,
    date: day,
    hoursToday: todaySession?.hoursLabel ?? "0m",
    hoursRange: member?.totalLabel ?? "0m",
    daysPresent: member?.daysPresent ?? 0,
    avgLabel: member?.avgLabel ?? "0m",
    kpi: {
      firstIn: daySession?.inAt ? formatIstTime(daySession.inAt) : null,
      lastOut: daySession?.outAt ? formatIstTime(daySession.outAt) : null,
      assumedOut: daySession?.assumedOut ?? false,
      hoursLabel: daySession?.hoursLabel ?? "0m",
    },
    enterCount: daySession?.enterCount ?? dayPunches.filter((p) => p.direction === "in").length,
    exitCount: daySession?.exitCount ?? dayPunches.filter((p) => p.direction === "out").length,
    visits: report.visits
      .filter((visit) => visit.date === day)
      .map((visit) => ({
        ...visit,
        inTime: formatIstTime(visit.inAt),
        outTime: visit.assumedOut
          ? visit.outAt
            ? formatIstTime(visit.outAt)
            : WORK_END_LABEL
          : visit.outAt
            ? formatIstTime(visit.outAt)
            : null,
      })),
    dayPunches,
    punches: [...report.punches].reverse().map((punch) => ({
      ...punch,
      time: formatIstTime(punch.createdAt),
      date: istDateKey(new Date(punch.createdAt)),
    })),
    days: report.days,
    sessions: report.sessions,
    members: report.members,
  });
}
