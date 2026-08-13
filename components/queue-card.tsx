import { timeAgo } from "@/lib/format";
import { formatIstTime } from "@/lib/hours";

export type QueueEvent = {
  id: string;
  kind: string;
  displayName: string;
  direction: string;
  method: string;
  reason?: string | null;
  createdAt: string | Date;
};

export function QueueCard({ events }: { events: QueueEvent[] }) {
  const shown = events.slice(0, 6);
  return (
    <div className="rounded-2xl border border-ink/10 bg-white">
      <div className="px-4 py-3 text-sm font-semibold">Recent</div>
      <div className="divide-y divide-ink/5">
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink/50">No gate events yet.</p>
        ) : (
          shown.map((event) => (
            <article key={event.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{event.displayName}</p>
                <span className="shrink-0 text-xs text-ink/40">
                  {timeAgo(event.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink/50">
                {event.kind === "visitor"
                  ? "Visitor"
                  : event.direction === "in"
                    ? "IN"
                    : "OUT"}{" "}
                · {formatIstTime(event.createdAt)}
                {event.reason ? ` · ${event.reason}` : ""}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
