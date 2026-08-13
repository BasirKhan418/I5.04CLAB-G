import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminUiProvider } from "@/components/admin-ui";
import { AppSidebar } from "@/components/app-sidebar";
import { DashNavbar } from "@/components/dash-navbar";

export const metadata: Metadata = pageMetadata({
  title: "Dashboard",
  description:
    "I5.04C Lab staff dashboard for who is inside, visitor approvals, hours, and door opens.",
  path: "/dashboard",
  index: false,
});

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.role === "admin" || session.role === "superadmin";
  const isSuperadmin = session.role === "superadmin";

  return (
    <TooltipProvider>
      <AdminUiProvider isAdmin={isAdmin} isSuperadmin={isSuperadmin}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0 overflow-x-hidden bg-cream">
            <DashNavbar name={session.name} email={session.email} />
            <div className="min-w-0 px-3 py-4 sm:px-6 sm:py-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </AdminUiProvider>
    </TooltipProvider>
  );
}
