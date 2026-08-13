import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";
import { AccessLog } from "@/models/AccessLog";
import Link from "next/link";
import { BrutalCard } from "@/components/brutal";
import { PendingApprovals } from "@/components/pending-approvals";
import {
  formatDuration,
  hoursOnDay,
  istDateKey,
  startOfIstDate,
} from "@/lib/hours";
import { buildHoursReport } from "@/lib/reports";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  await connectDB();
  const user = await User.findById(session.sub);
  const isAdmin = session.role === "admin" || session.role === "superadmin";

  const today = istDateKey();
  const [report, myLogs] = await Promise.all([
    buildHoursReport(today, today),
    AccessLog.find({
      kind: "member",
      userId: session.sub,
      createdAt: { $gte: startOfIstDate(today) },
    }).sort({ createdAt: 1 }),
  ]);

  if ("error" in report) {
    redirect("/dashboard/logs");
  }

  const myHoursToday = formatDuration(
    hoursOnDay(
      myLogs.map((log) => ({
        direction: log.direction as "in" | "out",
        createdAt: log.createdAt,
      })),
      today
    )
  );

  const inside = report.members.filter((member) => member.inside);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      {user?.mustChangePin ? (
        <BrutalCard className="border-lab-red bg-lab-pale p-4">
          <p className="font-medium">Please set your own PIN.</p>
          <Link
            href="/dashboard/profile"
            className="mt-1 inline-block text-sm font-semibold text-lab-red"
          >
            Open profile
          </Link>
        </BrutalCard>
      ) : null}

      {isAdmin ? <PendingApprovals /> : null}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Inside now", value: String(report.totals.insideNow) },
          { label: "Your hours today", value: myHoursToday },
        ].map((stat) => (
          <BrutalCard key={stat.label} className="p-3 sm:p-4">
            <p className="text-[11px] font-semibold tracking-wide text-ink/45 uppercase">
              {stat.label}
            </p>
            <p className="mt-1 font-heading text-2xl sm:text-3xl">{stat.value}</p>
          </BrutalCard>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <BrutalCard className="p-4">
          <p className="text-sm font-semibold">Who&apos;s in</p>
          {inside.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">Lab is empty.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {inside.map((member) =>
                isAdmin ? (
                  <Link
                    key={member.userId}
                    href={`/dashboard/members/${member.userId}`}
                    className="rounded-full border-2 border-ink bg-lab-mint/70 px-3 py-1 text-sm font-medium"
                  >
                    {member.name}
                  </Link>
                ) : (
                  <span
                    key={member.userId}
                    className="rounded-full border-2 border-ink bg-lab-mint/70 px-3 py-1 text-sm font-medium"
                  >
                    {member.name}
                  </span>
                )
              )}
            </div>
          )}
        </BrutalCard>
        <BrutalCard className="p-4">
          <p className="text-sm font-semibold">Still IN</p>
          {inside.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">Nobody is marked IN.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {inside.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0 truncate">{member.name}</span>
                  <span className="shrink-0 text-ink/50">{member.totalLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </BrutalCard>
      </div>
    </div>
  );
}
