import { TIMEZONE } from "@/lib/constants";

export type DirectionEvent = {
  direction: "in" | "out";
  createdAt: Date;
};

export type Session = {
  inAt: Date;
  outAt: Date | null;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfIstDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

export function endOfIstDate(isoDate: string): Date {
  return new Date(startOfIstDate(isoDate).getTime() + 86_400_000);
}

export function addIstDays(isoDate: string, days: number): string {
  return istDateKey(
    new Date(startOfIstDate(isoDate).getTime() + days * 86_400_000 + 60_000)
  );
}

export function eachIstDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = addIstDays(current, 1);
  }
  return dates;
}

export function startOfDayIST(now = new Date()): Date {
  return startOfIstDate(istDateKey(now));
}

export function monthStartIst(date = new Date()): string {
  return `${istDateKey(date).slice(0, 8)}01`;
}

export function shiftMonthStart(monthStart: string, delta: number): string {
  const [year, month] = monthStart.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function lastDayOfMonth(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
}

export function startOfWeekIst(date = new Date()): string {
  const key = istDateKey(date);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(date);
  const offset: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return addIstDays(key, -(offset[weekday] ?? 0));
}

export const WORK_START_LABEL = "9:00 AM";
export const WORK_END_LABEL = "5:30 PM";

export const workWindow = (isoDate: string) => {
  const day = startOfIstDate(isoDate);
  return {
    start: new Date(day.getTime() + 9 * 60 * 60_000),
    end: new Date(day.getTime() + (17 * 60 + 30) * 60_000),
  };
};

export function isAfterWorkEnd(date: Date, day = istDateKey(date)) {
  return date.getTime() > workWindow(day).end.getTime();
}

export type DayKpi = {
  date: string;
  firstIn: Date | null;
  lastOut: Date | null;
  kpiStart: Date | null;
  kpiEnd: Date | null;
  assumedOut: boolean;
  hoursMs: number;
  enterCount: number;
  exitCount: number;
  auditCount: number;
};

export function eventsOnIstDay(events: DirectionEvent[], day: string) {
  const from = startOfIstDate(day);
  const to = endOfIstDate(day);
  return events
    .filter((event) => event.createdAt >= from && event.createdAt < to)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function dayKpi(
  events: DirectionEvent[],
  day: string,
  now = new Date()
): DayKpi {
  const { start: workStart, end: workEnd } = workWindow(day);
  const dayEvents = eventsOnIstDay(events, day);
  const enterCount = dayEvents.filter((event) => event.direction === "in").length;
  const exitCount = dayEvents.filter((event) => event.direction === "out").length;
  const auditCount = dayEvents.filter((event) => event.createdAt > workEnd).length;
  const windowEvents = dayEvents.filter((event) => event.createdAt <= workEnd);
  const firstIn = windowEvents.find((event) => event.direction === "in") ?? null;

  if (!firstIn) {
    return {
      date: day,
      firstIn: null,
      lastOut: null,
      kpiStart: null,
      kpiEnd: null,
      assumedOut: false,
      hoursMs: 0,
      enterCount,
      exitCount,
      auditCount,
    };
  }

  const kpiStart = new Date(
    Math.max(firstIn.createdAt.getTime(), workStart.getTime())
  );
  const afterFirst = windowEvents.filter(
    (event) => event.createdAt.getTime() >= firstIn.createdAt.getTime()
  );
  const lastEvent = afterFirst[afterFirst.length - 1];
  const lastOut =
    [...afterFirst].reverse().find((event) => event.direction === "out") ?? null;
  const closed = lastEvent?.direction === "out" && Boolean(lastOut);

  let assumedOut = false;
  let kpiEnd: Date;
  if (closed && lastOut) {
    kpiEnd = new Date(Math.min(lastOut.createdAt.getTime(), workEnd.getTime()));
  } else {
    assumedOut = true;
    kpiEnd = new Date(Math.min(now.getTime(), workEnd.getTime()));
  }

  return {
    date: day,
    firstIn: firstIn.createdAt,
    lastOut: closed && lastOut ? lastOut.createdAt : null,
    kpiStart,
    kpiEnd,
    assumedOut,
    hoursMs: Math.max(0, kpiEnd.getTime() - kpiStart.getTime()),
    enterCount,
    exitCount,
    auditCount,
  };
}

export function pairSessions(events: DirectionEvent[]): Session[] {
  const sorted = [...events].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const sessions: Session[] = [];
  let open: Date | null = null;
  for (const event of sorted) {
    if (event.direction === "in") {
      if (!open) {
        open = event.createdAt;
      }
    } else if (event.direction === "out" && open) {
      sessions.push({ inAt: open, outAt: event.createdAt });
      open = null;
    }
  }
  if (open) {
    sessions.push({ inAt: open, outAt: null });
  }
  return sessions;
}

export function computeHoursMs(
  events: DirectionEvent[],
  until = new Date()
): number {
  const days = new Set(events.map((event) => istDateKey(event.createdAt)));
  if (days.size === 0) {
    days.add(istDateKey(until));
  }
  let total = 0;
  for (const day of days) {
    total += dayKpi(events, day, until).hoursMs;
  }
  return total;
}

export function hoursOnDay(
  events: DirectionEvent[],
  day: string,
  now = new Date()
): number {
  return dayKpi(events, day, now).hoursMs;
}

export function msToHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

export function isCurrentlyIn(events: DirectionEvent[]): boolean {
  const sorted = [...events].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  let inside = false;
  for (const event of sorted) {
    inside = event.direction === "in";
  }
  return inside;
}

export function formatIstTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function formatIstDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatIstDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function parseRange(from?: string | null, to?: string | null) {
  const today = istDateKey();
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : monthStartIst();
  const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}
