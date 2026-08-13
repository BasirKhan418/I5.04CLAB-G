"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { BrutalButton, BrutalInput } from "@/components/brutal";
import { HoursCharts } from "@/components/hours-charts";
import { StatusPill } from "@/components/status-pill";
import { useAdminUi } from "@/components/admin-ui";
import { api } from "@/lib/utils";
import {
  addIstDays,
  formatIstDateTime,
  istDateKey,
  lastDayOfMonth,
  monthStartIst,
  shiftMonthStart,
  startOfWeekIst,
} from "@/lib/hours";
import type { HoursReport } from "@/lib/reports";

const EVENT_PAGE = 80;

function presets() {
  const today = istDateKey();
  const thisMonth = monthStartIst();
  const prev = shiftMonthStart(thisMonth, -1);
  return [
    { id: "today", label: "Today", from: today, to: today },
    {
      id: "yesterday",
      label: "Yesterday",
      from: addIstDays(today, -1),
      to: addIstDays(today, -1),
    },
    { id: "week", label: "This week", from: startOfWeekIst(), to: today },
    { id: "month", label: "This month", from: thisMonth, to: today },
    {
      id: "prev",
      label: "Prev month",
      from: prev,
      to: lastDayOfMonth(prev),
    },
    {
      id: "last2",
      label: "Last 2 months",
      from: shiftMonthStart(thisMonth, -2),
      to: today,
    },
    {
      id: "last3",
      label: "Last 3 months",
      from: shiftMonthStart(thisMonth, -3),
      to: today,
    },
  ];
}

export function LogsExplorer() {
  const { isAdmin, toast } = useAdminUi();
  const today = istDateKey();
  const [from, setFrom] = useState(monthStartIst());
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<HoursReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [kind, setKind] = useState<"all" | "member" | "visitor">("all");
  const [query, setQuery] = useState("");
  const [eventLimit, setEventLimit] = useState(EVENT_PAGE);
  const ranges = useMemo(() => presets(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<HoursReport>(`/api/reports?from=${from}&to=${to}`).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setReport(null);
        return;
      }
      setError("");
      setReport(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    setEventLimit(EVENT_PAGE);
  }, [kind, query, from, to]);

  const punches = (report?.punches ?? []).filter((punch) => {
    if (kind !== "all" && punch.kind !== kind) return false;
    if (!query.trim()) return true;
    const hay = `${punch.name} ${punch.email ?? ""} ${punch.reason ?? ""}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });
  const shownPunches = punches.slice(0, eventLimit);

  const peoplePresent =
    report?.members.filter((member) => member.daysPresent > 0).length ?? 0;
  const memberPunches =
    report?.punches.filter((punch) => punch.kind === "member").length ?? 0;

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/export?from=${from}&to=${to}`);
      if (!res.ok) {
        toast("Could not export Excel.", "err");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `I5.04C-Lab-${from}-to-${to}.xlsx`;
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink/60">
          History for the lab. Date range drives hours, charts, and Excel.
        </p>
        <BrutalButton
          type="button"
          loading={exporting}
          onClick={exportExcel}
          className="w-full sm:w-auto"
        >
          <Download className="size-4" />
          Export hours Excel
        </BrutalButton>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {ranges.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setFrom(item.from);
              setTo(item.to);
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>

      {error ? <p className="text-sm text-lab-red">{error}</p> : null}

      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold">Hours</p>
          <p className="text-xs text-ink/45">
            Member hours (sum) = each person’s 9:00 AM–5:30 PM time, first IN to
            last OUT. Not how long the room was occupied. After 5:30 PM is audit
            only.
          </p>
        </div>

        {report ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Member hours (sum)", value: report.totals.memberHoursLabel },
              { label: "Member punches", value: String(memberPunches) },
              { label: "Visitors", value: String(report.totals.visitors) },
              { label: "People present", value: String(peoplePresent) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[24px] border border-ink/10 bg-white p-3 sm:p-4"
              >
                <p className="text-[11px] font-semibold tracking-wide text-ink/45 uppercase">
                  {stat.label}
                </p>
                <p className="mt-1 font-heading text-2xl sm:text-3xl">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ink/50">Loading hours…</p>
        ) : report ? (
          <HoursCharts days={report.days} members={report.members} />
        ) : null}

        {report ? (
          <div className="overflow-hidden rounded-[24px] border border-ink/10 bg-white">
            <div className="border-b border-ink/10 px-4 py-3 text-sm font-semibold">
              Hours by person
            </div>
            <div className="md:hidden divide-y divide-ink/10">
              {report.members.map((member) => (
                <PersonRow
                  key={member.userId}
                  admin={isAdmin}
                  userId={member.userId}
                  name={member.name}
                  detail={`${member.daysPresent} days · avg ${member.avgLabel}`}
                  hours={member.totalLabel}
                  inside={member.inside}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-lab-pale text-ink/60">
                  <tr>
                    <th className="px-4 py-2 font-medium">Person</th>
                    <th className="px-4 py-2 font-medium">Days</th>
                    <th className="px-4 py-2 font-medium">Hours</th>
                    <th className="px-4 py-2 font-medium">Avg / day</th>
                    <th className="px-4 py-2 font-medium">Now</th>
                  </tr>
                </thead>
                <tbody>
                  {report.members.map((member) => (
                    <tr key={member.userId} className="border-t border-ink/10">
                      <td className="px-4 py-3">
                        <PersonName
                          admin={isAdmin}
                          userId={member.userId}
                          name={member.name}
                        />
                        <p className="text-xs text-ink/45">{member.email}</p>
                      </td>
                      <td className="px-4 py-3">{member.daysPresent}</td>
                      <td className="px-4 py-3">{member.totalLabel}</td>
                      <td className="px-4 py-3">{member.avgLabel}</td>
                      <td className="px-4 py-3">
                        <StatusPill inside={member.inside} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Event log</p>
          <p className="text-xs text-ink/45">
            Kind and search filter this list only — not hours, charts, or Excel.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink/50">
            Search events
            <BrutalInput
              className="mt-1"
              placeholder="Name or reason"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-ink/50">
            Kind
            <select
              className="mt-1 h-11 w-full rounded-lg border border-ink/15 bg-white px-3.5 text-sm outline-none"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="all">All events</option>
              <option value="member">Members</option>
              <option value="visitor">Visitors</option>
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-ink/10 bg-white">
          <div className="border-b border-ink/10 px-4 py-3 text-sm font-semibold">
            Showing {shownPunches.length} of {punches.length} events
          </div>
          <div className="md:hidden divide-y divide-ink/10">
            {shownPunches.map((punch) => (
              <div key={punch.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{punch.name}</p>
                  <span className="shrink-0 text-xs font-bold uppercase">
                    {punch.direction}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/50">
                  {formatIstDateTime(punch.createdAt)} · {punch.kind}
                  {punch.reason ? ` · ${punch.reason}` : ""}
                  {punch.auditOnly ? " · audit" : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="sticky top-0 bg-lab-pale text-ink/60">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 font-medium">IN / OUT</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {shownPunches.map((punch) => (
                  <tr key={punch.id} className="border-t border-ink/10">
                    <td className="px-4 py-3 whitespace-nowrap text-ink/70">
                      {formatIstDateTime(punch.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {isAdmin && punch.kind === "member" && punch.userId ? (
                        <Link
                          href={`/dashboard/members/${punch.userId}`}
                          className="hover:underline"
                        >
                          {punch.name}
                        </Link>
                      ) : (
                        punch.name
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{punch.kind}</td>
                    <td className="px-4 py-3 uppercase">{punch.direction}</td>
                    <td className="px-4 py-3 text-ink/60">
                      {punch.method}
                      {punch.status !== "approved" ? ` · ${punch.status}` : ""}
                      {punch.reason ? ` · ${punch.reason}` : ""}
                      {punch.auditOnly ? " · audit" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && punches.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink/50">No events in this range.</p>
          ) : null}
          {punches.length > eventLimit ? (
            <div className="border-t border-ink/10 px-4 py-3">
              <button
                type="button"
                className="text-sm font-semibold text-lab-red"
                onClick={() => setEventLimit((n) => n + EVENT_PAGE)}
              >
                Show more
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PersonName({
  admin,
  userId,
  name,
}: {
  admin: boolean;
  userId: string;
  name: string;
}) {
  if (!admin) {
    return <p className="font-medium">{name}</p>;
  }
  return (
    <Link href={`/dashboard/members/${userId}`} className="font-medium hover:underline">
      {name}
    </Link>
  );
}

function PersonRow({
  admin,
  userId,
  name,
  detail,
  hours,
  inside,
}: {
  admin: boolean;
  userId: string;
  name: string;
  detail: string;
  hours: string;
  inside: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <PersonName admin={admin} userId={userId} name={name} />
        <p className="text-xs text-ink/45">{detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">{hours}</p>
        <StatusPill inside={inside} />
      </div>
    </div>
  );
}
