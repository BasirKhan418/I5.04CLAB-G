import Link from "next/link";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";

export function SiteHeader({
  signedIn,
}: {
  signedIn?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <a href="#what">What you get</a>
          <a href="#how">How it works</a>
          <a href="#kiosk">Kiosk</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link
          href={signedIn ? "/dashboard" : "/login"}
          className={cn(
            "rounded-full border-2 border-ink bg-lab-red px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_0_#111]"
          )}
        >
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
      </div>
    </header>
  );
}
