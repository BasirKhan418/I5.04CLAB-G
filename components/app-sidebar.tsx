"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Camera,
  LayoutDashboard,
  LogOut,
  ScanLine,
  ScrollText,
  Server,
  Unlock,
  UserRound,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Eyes } from "@/components/brand";
import { useAdminUi } from "@/components/admin-ui";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/camera", label: "Camera", icon: Camera },
  { href: "/dashboard/logs", label: "Logs", icon: ScrollText },
  { href: "/dashboard/members", label: "Members", icon: Users, admin: true },
  {
    href: "/dashboard/infrastructure",
    label: "Infrastructure",
    icon: Server,
    admin: true,
  },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, pendingCount, openDoor } = useAdminUi();
  const { setOpenMobile, isMobile } = useSidebar();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon" className="border-r-2 border-ink bg-cream">
      <SidebarHeader className="border-b-2 border-ink px-3 py-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 font-semibold"
        >
          <Eyes />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            I5.04C <span className="font-heading italic">Lab</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-1">
              {links
                .filter((link) => !link.admin || isAdmin)
                .map((link) => {
                  const active =
                    link.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === link.href ||
                        pathname.startsWith(`${link.href}/`);
                  const Icon = link.icon;
                  return (
                    <SidebarMenuItem key={link.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={link.label}
                        render={<Link href={link.href} />}
                        onClick={(event) => {
                          if (isMobile) setOpenMobile(false);
                          event.currentTarget.blur();
                        }}
                        className={cn(
                          "h-10 rounded-full border-2 border-transparent px-3",
                          active &&
                            "border-ink bg-lab-red text-white hover:bg-lab-red hover:text-white data-active:bg-lab-red data-active:text-white"
                        )}
                      >
                        <Icon />
                        <span>{link.label}</span>
                        {link.href === "/dashboard" && pendingCount > 0 ? (
                          <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-lab-red group-data-[collapsible=icon]:hidden">
                            {pendingCount}
                          </span>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t-2 border-ink p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Allow — open door"
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                openDoor();
              }}
              className="h-10 rounded-full border-2 border-ink bg-lab-red px-3 text-white hover:bg-lab-red hover:text-white"
            >
              <Unlock />
              <span>Allow</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Kiosk"
              render={<Link href="/" />}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
              className="h-10 rounded-full px-3 text-ink hover:bg-ink/5"
            >
              <ScanLine />
              <span>Open kiosk</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              disabled={leaving}
              onClick={logout}
              className="h-10 rounded-full px-3 text-ink hover:bg-ink/5"
            >
              <LogOut />
              <span>{leaving ? "Signing out…" : "Logout"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pb-1 text-xs text-ink/50 group-data-[collapsible=icon]:hidden">
          I5.04C Lab · R&amp;D
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
