"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TIMEZONE } from "@/lib/constants";

function pageTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/dashboard/logs") return "Logs";
  if (pathname === "/dashboard/members") return "Members";
  if (pathname.startsWith("/dashboard/members/")) return "Member";
  if (pathname === "/dashboard/profile") return "Profile";
  if (pathname === "/dashboard/infrastructure") return "Infrastructure";
  return "I5.04C Lab";
}

function formatIstClock(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function DashNavbar({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [clock, setClock] = useState("");
  const title = pageTitle(pathname);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const tick = () => setClock(formatIstClock());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b-2 border-ink bg-white px-3 sm:h-16 sm:gap-3 sm:px-4">
      <SidebarTrigger className="size-9 shrink-0 rounded-full border-2 border-ink" />
      <h1 className="min-w-0 flex-1 truncate font-heading text-lg sm:text-2xl">
        {title}
      </h1>
      {clock ? (
        <p className="hidden shrink-0 text-xs text-ink/45 sm:block">
          IST · {clock}
        </p>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-lab-pale text-sm font-semibold outline-none sm:size-10"
          aria-label="Profile menu"
        >
          {initials}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 min-w-56 border-2 border-ink">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <p className="truncate font-semibold text-foreground">{name}</p>
              <p className="truncate text-xs font-normal">{email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={leaving}
            onClick={logout}
          >
            {leaving ? "Signing out…" : "Logout"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
