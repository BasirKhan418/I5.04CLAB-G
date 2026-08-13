"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { BrutalButton } from "@/components/brutal";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/logs", label: "Logs" },
  { href: "/dashboard/members", label: "Members", admin: true },
  { href: "/dashboard/profile", label: "Profile" },
];

export function DashNav({
  role,
  name,
}: {
  role: string;
  name: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b-2 border-ink bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Logo href="/dashboard" />
        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
          {links
            .filter((link) => !link.admin || role === "admin" || role === "superadmin")
            .map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  pathname === link.href && "underline decoration-2 underline-offset-4"
                )}
              >
                {link.label}
              </Link>
            ))}
        </nav>
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="hidden shrink-0 text-sm font-semibold underline sm:inline"
          >
            Kiosk
          </Link>
          <span className="max-w-[30vw] truncate text-sm text-ink/70 sm:max-w-[12rem]">
            {name}
          </span>
          <BrutalButton
            type="button"
            loading={leaving}
            className="px-3 py-1.5"
            onClick={logout}
          >
            Logout
          </BrutalButton>
        </div>
      </div>
    </header>
  );
}
