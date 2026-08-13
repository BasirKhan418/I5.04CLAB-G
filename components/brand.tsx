import Link from "next/link";
import { cn } from "@/lib/utils";

export function Eyes({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)} aria-hidden>
      <span className="size-4 rounded-full border-2 border-ink bg-lab-red" />
      <span className="-ml-1.5 size-4 rounded-full border-2 border-ink bg-lab-yellow" />
    </span>
  );
}

export function Logo({
  href = "/",
  mark = true,
}: {
  href?: string;
  mark?: boolean;
}) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2 font-semibold">
      {mark ? <Eyes /> : null}
      <span className="truncate">
        I5.04C <span className="font-heading italic">Lab</span>
      </span>
    </Link>
  );
}
