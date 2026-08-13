import { cn } from "@/lib/utils";

export function BrutalButton({
  className,
  variant = "red",
  loading = false,
  shine = false,
  soft = false,
  children,
  disabled,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "red" | "white" | "ink" | "mint";
  loading?: boolean;
  shine?: boolean;
  soft?: boolean;
}) {
  const variants = {
    red: "bg-lab-red text-white",
    white: "bg-white text-ink",
    ink: "bg-ink text-white",
    mint: "bg-lab-mint text-ink",
  };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-transform duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
        soft
          ? "border border-ink/20 shadow-none hover:border-ink/40"
          : "border-2 border-ink shadow-[4px_4px_0_#111] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] active:translate-x-1 active:translate-y-1 active:shadow-none",
        shine && "shine-btn",
        variants[variant],
        className
      )}
      {...props}
    >
      {loading ? <span className="btn-spinner relative z-10" aria-hidden /> : null}
      <span className={cn("relative z-10", loading && "opacity-80")}>{children}</span>
    </button>
  );
}

export function BrutalCard({
  className,
  tone = "loud",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "loud" | "quiet";
}) {
  return (
    <div
      className={cn(
        tone === "loud"
          ? "rounded-[28px] border-2 border-ink bg-white shadow-[6px_6px_0_#111]"
          : "rounded-2xl border border-ink/10 bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]",
        className
      )}
      {...props}
    />
  );
}

export function BrutalInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-ink/15 bg-white px-3.5 text-sm outline-none transition placeholder:text-ink/40 focus:border-ink/40",
        className
      )}
      {...props}
    />
  );
}

export function BrutalTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full min-w-0 rounded-lg border border-ink/15 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-ink/40 focus:border-ink/40",
        className
      )}
      {...props}
    />
  );
}
