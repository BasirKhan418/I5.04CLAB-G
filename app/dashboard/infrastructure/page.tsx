import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { InfrastructureForm } from "./infrastructure-form";

export default async function InfrastructurePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/dashboard");
  }

  return <InfrastructureForm />;
}
