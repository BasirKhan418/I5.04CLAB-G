"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { BrutalButton, BrutalInput } from "@/components/brutal";
import { EditMemberModal } from "@/components/edit-member-modal";
import { HoursCharts } from "@/components/hours-charts";
import { StatusPill } from "@/components/status-pill";
import { useAdminUi } from "@/components/admin-ui";
import { api, cn } from "@/lib/utils";
import {
  istDateKey,
  lastDayOfMonth,
  monthStartIst,
  shiftMonthStart,
  startOfWeekIst,
} from "@/lib/hours";
import type { DayPoint, MemberHours, ReportSession } from "@/lib/reports";

type Punch = {
  id: string;
  direction: string;
  method: string;
  createdAt: string;
  time: string;
  date?: string;
  auditOnly: boolean;
  extraIn?: boolean;
  note?: string | null;
};

type Activity = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  notifyWhatsApp?: boolean;
  inside: boolean;
  window: string;
  from: string;
  to: string;
  date: string;
  hoursToday: string;
  hoursRange: string;
  daysPresent: number;
  avgLabel: string;
  kpi: {
    firstIn: string | null;
    lastOut: string | null;
    assumedOut: boolean;
    hoursLabel: string;
  };
  enterCount: number;
  exitCount: number;
  dayPunches: Punch[];
  punches: Punch[];
  days: DayPoint[];
  sessions: ReportSession[];
  members: MemberHours[];
};

function presets() {
  const today = istDateKey();
  const thisMonth = monthStartIst();
  const prev = shiftMonthStart(thisMonth, -1);
  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "week", label: "This week", from: startOfWeekIst(), to: today },
    { id: "month", label: "This month", from: thisMonth, to: today },
    { id: "prev", label: "Prev month", from: prev, to: lastDayOfMonth(prev) },
    {
      id: "last2",
      label: "Last 2 months",
      from: shiftMonthStart(thisMonth, -2),
      to: today,
    },
  ];
}

export function MemberActivity({ memberId }: { memberId: string }) {
  const { isSuperadmin, toast } = useAdminUi();
  const today = istDateKey();
  const [from, setFrom] = useState(monthStartIst());
  const [to, setTo] = useState(today);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);
  const ranges = useMemo(() => presets(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api<Activity>(
      `/api/members/${memberId}/activity?from=${from}&to=${to}&date=${date}`
    ).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setData(null);
        return;
      }
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [memberId, from, to, date, reload]);

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch(
        `/api/reports/export?from=${from}&to=${to}&userId=${memberId}`
      );
      if (!res.ok) {
        toast("Could not export Excel.", "err");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const who = (data?.name ?? "member").replace(/[^\w]+/g, "-");
      link.href = url;
      link.download = `I5.04C-Lab-${who}-${from}-to-${to}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast("Excel downloaded.");
    } finally {
      setExporting(false);
    }
  }

  const activePreset = ranges.find((item) => item.from === from && item.to === to)?.id;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/members"
            className="text-sm font-semibold text-lab-red"
          >
            ← Members
          </Link>
          <h2 className="mt-1 font-heading text-2xl">
            {data?.name ?? "Member"}
          </h2>
          <p className="text-sm text-ink/55">
            {data?.email}
            {data?.phone ? ` · ${data.phone}` : ""}
            {data ? ` · ${data.role}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data ? <StatusPill inside={data.inside} /> : null}
            <span className="text-xs text-ink/45">
              Hours {data?.window ?? "9:00 AM – 5:30 PM"} · first IN to last OUT
            </span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <BrutalButton
            type="button"
            variant="white"
            onClick={() => setEditing(true)}
            className="w-full sm:w-auto"
          >
            Edit member
          </BrutalButton>
          <BrutalButton
            type="button"
            loading={exporting}
            onClick={exportExcel}
            className="w-full sm:w-auto"
          >
            <Download className="size-4" />
            Export hours
          </BrutalButton>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {ranges.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setFrom(item.from);
              setTo(item.to);
              setDate(item.to);
            }}
            className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-sm ${
              activePreset === item.id
                ? "border-ink bg-lab-red text-white"
                : "border-ink/15 bg-white text-ink/70"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-ink/50">
          From
          <BrutalInput
            className="mt-1"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-ink/50">
          To
          <BrutalInput
            className="mt-1"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-ink/50">
          Day log
          <BrutalInput
            className="mt-1"
            type="date"
            value={date}
            min={from}
            max={to}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-lab-red">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/50">Loading member hours…</p> : null}

      {data && !loading ? (
        <div className="space-y-5">
          <section className="space-y-4">
            <p className="text-sm font-semibold">Hours</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "This day", value: data.kpi.hoursLabel },
                { label: "Range hours", value: data.hoursRange },
                { label: "Days present", value: String(data.daysPresent) },
                { label: "Avg / day", value: data.avgLabel },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[24px] border border-ink/10 bg-white p-3 sm:p-4"
                >
                  <p className="text-[11px] font-semibold tracking-wide text-ink/45 uppercase">
                    {stat.label}
                  </p>
                  <p className="mt-1 font-heading text-2xl">{stat.value}</p>
                </div>
              ))}
            </div>
            <HoursCharts days={data.days} members={data.members} compact />
          </section>

          <section className="rounded-[24px] border border-ink/10 bg-white p-4">
            <p className="font-semibold">Day log · {date}</p>
            <p className="mt-1 text-sm text-ink/60">
              First IN {data.kpi.firstIn ?? "—"} →{" "}
              {data.kpi.assumedOut
                ? "assumed 5:30 PM"
                : data.kpi.lastOut ?? "—"}
              {" · "}
              {data.enterCount} enter · {data.exitCount} exit
            </p>
            <p className="mt-1 font-heading text-2xl">{data.kpi.hoursLabel}</p>
            {data.dayPunches.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">No punches on this day.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink/10 rounded-xl border border-ink/10">
                {data.dayPunches.map((punch) => (
                  <li
                    key={punch.id}
                    className={cn(
                      "px-3 py-2 text-sm",
                      punch.auditOnly && "bg-lab-pale/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold uppercase">
                        {punch.direction}
                      </span>
                      <span className="text-ink/60">
                        {punch.time} · {punch.method}
                      </span>
                    </div>
                    {punch.note ? (
                      <p className="mt-0.5 text-xs text-ink/50">{punch.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold">Daily hours</p>
            <div className="overflow-hidden rounded-[24px] border border-ink/10 bg-white">
              {data.sessions.length === 0 ? (
                <p className="px-3 py-4 text-sm text-ink/50">No days in range.</p>
              ) : (
                <ul className="max-h-64 divide-y divide-ink/10 overflow-y-auto">
                  {data.sessions.map((session) => (
                    <li key={session.date}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm",
                          session.date === date && "bg-lab-pale"
                        )}
                        onClick={() => setDate(session.date)}
                      >
                        <span>
                          {session.date}
                          <span className="ml-2 text-xs text-ink/45">
                            {session.enterCount} IN / {session.exitCount} OUT
                          </span>
                        </span>
                        <span className="font-semibold">{session.hoursLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold">Punches in range</p>
            {data.punches.length === 0 ? (
              <p className="text-sm text-ink/50">No punches in this range.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-ink/10 overflow-y-auto rounded-[24px] border border-ink/10 bg-white">
                {data.punches.map((punch) => (
                  <li
                    key={punch.id}
                    className={cn(
                      "px-4 py-2.5 text-sm",
                      punch.auditOnly && "bg-lab-pale/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold uppercase">
                        {punch.direction}
                      </span>
                      <span className="text-ink/60">
                        {punch.date} · {punch.time}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <EditMemberModal
        member={
          data
            ? {
                id: data.id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.role,
                notifyWhatsApp: data.notifyWhatsApp,
              }
            : null
        }
        open={editing}
        onOpenChange={setEditing}
        toast={toast}
        canAssignSuperadmin={isSuperadmin}
        onSaved={() => setReload((n) => n + 1)}
      />
    </div>
  );
}
