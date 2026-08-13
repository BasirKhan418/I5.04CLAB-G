import { formatIstTime } from "@/lib/hours";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RecentPunch = {
  id: string;
  name: string;
  kind: string;
  direction: string;
  method: string;
  reason?: string | null;
  createdAt: string;
};

export function RecentLogList({
  punches,
  empty = "No IN / OUT yet.",
}: {
  punches: RecentPunch[];
  empty?: string;
}) {
  if (punches.length === 0) {
    return (
      <p className="px-1 py-6 text-sm text-ink/50">{empty}</p>
    );
  }

  return (
    <ul className="divide-y divide-ink/10">
      {punches.map((punch) => (
        <li
          key={punch.id}
          className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
              punch.kind === "visitor"
                ? "bg-lab-yellow/80"
                : punch.direction === "in"
                  ? "bg-lab-mint/80"
                  : "bg-ink/8"
            )}
          >
            {punch.kind === "visitor"
              ? "VIS"
              : punch.direction === "in"
                ? "IN"
                : "OUT"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{punch.name}</p>
            <p className="truncate text-xs text-ink/50">
              {formatIstTime(punch.createdAt)}
              {punch.reason ? ` · ${punch.reason}` : ` · ${punch.method}`}
            </p>
          </div>
          <span className="shrink-0 text-xs text-ink/40">
            {timeAgo(punch.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
