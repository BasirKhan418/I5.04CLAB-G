import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";
import { MemberActivity } from "@/components/member-activity";

type PageProps = { params: Promise<{ id: string }> };

export default async function MemberPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/dashboard");
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectDB();
  const user = await User.findById(id);
  if (!user) {
    notFound();
  }

  return <MemberActivity memberId={id} />;
}
