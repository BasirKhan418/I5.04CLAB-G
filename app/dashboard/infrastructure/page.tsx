import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { InfrastructureForm } from "./infrastructure-form";

export const metadata: Metadata = pageMetadata({
  title: "Infrastructure",
  description:
    "Configure I5.04C Lab door hardware, open duration, and device access.",
  path: "/dashboard/infrastructure",
  index: false,
});

export default async function InfrastructurePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/dashboard");
  }

  return <InfrastructureForm />;
}
