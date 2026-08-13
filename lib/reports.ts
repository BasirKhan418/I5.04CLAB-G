import mongoose from "mongoose";
import { User } from "@/models/User";
import { AccessLog } from "@/models/AccessLog";
import {
  dayKpi,
  eachIstDate,
  endOfIstDate,
  formatDuration,
  isAfterWorkEnd,
  msToHours,
  parseRange,
  startOfIstDate,
  type DirectionEvent,
} from "@/lib/hours";

export type ReportPunch = {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  kind: "member" | "visitor";
  direction: "in" | "out";
  method: string;
  status: string;
  reason: string | null;
  createdAt: string;
  auditOnly: boolean;
};

export type ReportSession = {
  userId: string;
  name: string;
  email: string;
  date: string;
  inAt: string | null;
  outAt: string | null;
  hoursMs: number;
  hours: number;
  hoursLabel: string;
  open: boolean;
  assumedOut: boolean;
  enterCount: number;
  exitCount: number;
  auditCount: number;
};

export type MemberHours = {
  userId: string;
  name: string;
  email: string;
  role: string;
  daysPresent: number;
  totalHoursMs: number;
  totalHours: number;
  totalLabel: string;
  avgHours: number;
  avgLabel: string;
  inside: boolean;
};

export type DayPoint = {
  date: string;
  hours: number;
  ins: number;
  outs: number;
  visitors: number;
};

export type HoursReport = {
  from: string;
  to: string;
  generatedAt: string;
  punches: ReportPunch[];
  sessions: ReportSession[];
  members: MemberHours[];
  days: DayPoint[];
  totals: {
    memberHours: number;
    memberHoursLabel: string;
    punches: number;
    visitors: number;
    insideNow: number;
    openSessions: number;
  };
};

const MAX_DAYS = 366;

export async function getLastDirections() {
  const rows = await AccessLog.aggregate<{
    _id: unknown;
    direction: "in" | "out";
  }>([
    { $match: { kind: "member", userId: { $ne: null } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$userId",
        direction: { $first: "$direction" },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.direction]));
}

export async function buildHoursReport(
  fromParam?: string | null,
  toParam?: string | null,
  userId?: string | null
): Promise<HoursReport | { error: string }> {
  const { from, to } = parseRange(fromParam, toParam);
  const span = eachIstDate(from, to);
  if (span.length > MAX_DAYS) {
    return { error: "Pick a range of 12 months or less." };
  }
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    return { error: "Member not found" };
  }

  const rangeStart = startOfIstDate(from);
  const rangeEnd = endOfIstDate(to);
  const now = new Date();
  const userFilter = userId ? { _id: userId } : {};
  const logFilter: Record<string, unknown> = {
    createdAt: { $gte: rangeStart, $lt: rangeEnd },
  };
  if (userId) {
    logFilter.kind = "member";
    logFilter.userId = userId;
  }

  const [users, logs, lastDirection] = await Promise.all([
    User.find(userFilter).sort({ name: 1 }),
    AccessLog.find(logFilter).sort({ createdAt: 1 }),
    getLastDirections(),
  ]);

  if (userId && users.length === 0) {
    return { error: "Member not found" };
  }

  const userById = new Map(
    users.map((user) => [
      String(user._id),
      {
        name: user.name,
        email: user.email,
        role: user.role as string,
      },
    ])
  );

  const punches: ReportPunch[] = logs
    .filter((log) => log.createdAt >= rangeStart && log.createdAt < rangeEnd)
    .map((log) => {
      const id = log.userId ? String(log.userId) : null;
      const person = id ? userById.get(id) : null;
      return {
        id: String(log._id),
        userId: id,
        name: person?.name ?? log.displayName,
        email: person?.email ?? null,
        kind: log.kind as "member" | "visitor",
        direction: log.direction as "in" | "out",
        method: log.method,
        status: log.status,
        reason: log.reason ?? null,
        createdAt: log.createdAt.toISOString(),
        auditOnly:
          log.kind === "member" && isAfterWorkEnd(log.createdAt),
      };
    });

  const sessions: ReportSession[] = [];
  const hoursByDay = new Map(span.map((date) => [date, 0]));
  const memberHours: MemberHours[] = users.map((user) => {
    const userId = String(user._id);
    const events: DirectionEvent[] = logs
      .filter(
        (log) =>
          log.kind === "member" &&
          log.userId &&
          String(log.userId) === userId
      )
      .map((log) => ({
        direction: log.direction as "in" | "out",
        createdAt: log.createdAt,
      }));

    let totalHoursMs = 0;
    let daysPresent = 0;
    for (const date of span) {
      const kpi = dayKpi(events, date, now);
      hoursByDay.set(date, (hoursByDay.get(date) ?? 0) + kpi.hoursMs);
      if (kpi.hoursMs > 0) {
        daysPresent += 1;
        totalHoursMs += kpi.hoursMs;
      }
      if (kpi.enterCount === 0 && kpi.exitCount === 0) continue;
      sessions.push({
        userId,
        name: user.name,
        email: user.email,
        date,
        inAt: kpi.firstIn?.toISOString() ?? null,
        outAt: kpi.lastOut?.toISOString() ?? null,
        hoursMs: kpi.hoursMs,
        hours: msToHours(kpi.hoursMs),
        hoursLabel: formatDuration(kpi.hoursMs),
        open: kpi.assumedOut,
        assumedOut: kpi.assumedOut,
        enterCount: kpi.enterCount,
        exitCount: kpi.exitCount,
        auditCount: kpi.auditCount,
      });
    }

    const avgMs = daysPresent ? totalHoursMs / daysPresent : 0;
    return {
      userId,
      name: user.name,
      email: user.email,
      role: user.role,
      daysPresent,
      totalHoursMs,
      totalHours: msToHours(totalHoursMs),
      totalLabel: formatDuration(totalHoursMs),
      avgHours: msToHours(avgMs),
      avgLabel: formatDuration(avgMs),
      inside: lastDirection.get(userId) === "in",
    };
  });

  const days: DayPoint[] = span.map((date) => {
    const dayStart = startOfIstDate(date);
    const dayEnd = endOfIstDate(date);
    const dayPunches = punches.filter((punch) => {
      const t = new Date(punch.createdAt);
      return t >= dayStart && t < dayEnd;
    });
    return {
      date,
      hours: msToHours(hoursByDay.get(date) ?? 0),
      ins: dayPunches.filter(
        (p) => p.kind === "member" && p.direction === "in" && !p.auditOnly
      ).length,
      outs: dayPunches.filter(
        (p) => p.kind === "member" && p.direction === "out" && !p.auditOnly
      ).length,
      visitors: dayPunches.filter((p) => p.kind === "visitor").length,
    };
  });

  const memberHoursMs = memberHours.reduce((sum, m) => sum + m.totalHoursMs, 0);

  return {
    from,
    to,
    generatedAt: now.toISOString(),
    punches: [...punches].reverse(),
    sessions,
    members: memberHours.sort((a, b) => b.totalHoursMs - a.totalHoursMs),
    days,
    totals: {
      memberHours: msToHours(memberHoursMs),
      memberHoursLabel: formatDuration(memberHoursMs),
      punches: punches.length,
      visitors: punches.filter((p) => p.kind === "visitor").length,
      insideNow: memberHours.filter((m) => m.inside).length,
      openSessions: memberHours.filter((m) => m.inside).length,
    },
  };
}
