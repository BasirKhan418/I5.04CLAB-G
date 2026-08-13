import { cn } from "@/lib/utils";

export function StatusPill({
  inside,
  className,
}: {
  inside: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
        inside ? "bg-lab-mint/80 text-ink" : "bg-ink/5 text-ink/55",
        className
      )}
    >
      {inside ? "IN" : "OUT"}
    </span>
  );
}
