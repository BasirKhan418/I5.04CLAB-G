import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";
import { AccessLog } from "@/models/AccessLog";
import { redirect } from "next/navigation";
import { MembersAdmin } from "./members-admin";
import {
  formatDuration,
  hoursOnDay,
  istDateKey,
  monthStartIst,
  startOfIstDate,
} from "@/lib/hours";
import { getLastDirections } from "@/lib/reports";

export const metadata: Metadata = pageMetadata({
  title: "Members",
  description:
    "Manage I5.04C Lab members, roles, hours, and kiosk access.",
  path: "/dashboard/members",
  index: false,
});

export default async function MembersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/dashboard");
  }

  await connectDB();
  const today = istDateKey();
  const [users, logs, lastDirection] = await Promise.all([
    User.find().sort({ createdAt: 1 }),
    AccessLog.find({
      kind: "member",
      createdAt: { $gte: startOfIstDate(monthStartIst()) },
    }).sort({ createdAt: 1 }),
    getLastDirections(),
  ]);

  return (
    <MembersAdmin
      me={session.sub}
      members={users.map((user) => {
        const events = logs
          .filter((log) => String(log.userId) === String(user._id))
          .map((log) => ({
            direction: log.direction as "in" | "out",
            createdAt: log.createdAt,
          }));
        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
          role: user.role,
          inside: lastDirection.get(String(user._id)) === "in",
          hoursToday: formatDuration(hoursOnDay(events, today)),
        };
      })}
    />
  );
}
