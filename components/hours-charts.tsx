"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DayPoint, MemberHours } from "@/lib/reports";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: "2px solid #111",
  fontSize: 12,
  background: "#fff",
};

export function HoursCharts({
  days,
  members,
  compact = false,
}: {
  days: DayPoint[];
  members: MemberHours[];
  compact?: boolean;
}) {
  const memberBars = members
    .filter((member) => member.totalHours > 0)
    .slice(0, 8)
    .map((member) => ({
      name: member.name.length > 16 ? `${member.name.slice(0, 15)}…` : member.name,
      hours: member.totalHours,
    }));

  return (
    <div
      className={cn(
        "grid min-w-0 gap-4",
        compact ? "lg:grid-cols-2" : "lg:grid-cols-2"
      )}
    >
      <ChartCard title="Member hours by day">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgba(17,17,17,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickFormatter={shortDate}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="hours" fill="#FF4D40" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      {compact ? (
        <ChartCard title="IN / OUT / visitors">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(17,17,17,0.08)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={shortDate}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="ins" name="IN" stroke="#FF4D40" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="outs" name="OUT" stroke="#111111" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="visitors" name="Visitors" stroke="#3aa37a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <>
          <ChartCard title="Hours by member">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={memberBars}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(17,17,17,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={64}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="hours" fill="#111111" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="IN / OUT / visitors" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={days} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(17,17,17,0.08)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={shortDate}
                  interval="preserveStartEnd"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="ins" name="IN" stroke="#FF4D40" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outs" name="OUT" stroke="#111111" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="visitors" name="Visitors" stroke="#3aa37a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-[24px] border-2 border-ink bg-white p-3 sm:p-4",
        className
      )}
    >
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="h-[200px] w-full min-w-0 sm:h-[220px]">{children}</div>
    </div>
  );
}

function shortDate(value: string) {
  return value.slice(5);
}
