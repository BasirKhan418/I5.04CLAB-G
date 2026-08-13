import type { Metadata } from "next";
import mongoose from "mongoose";
import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";
import { MemberActivity } from "@/components/member-activity";
import { pageMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return pageMetadata({
      title: "Member",
      description: "I5.04C Lab member activity and hours.",
      path: `/dashboard/members/${id}`,
      index: false,
    });
  }

  await connectDB();
  const user = await User.findById(id).select("name");
  const name = user?.name ?? "Member";

  return pageMetadata({
    title: name,
    description: `${name}'s I5.04C Lab punches, hours, and access activity.`,
    path: `/dashboard/members/${id}`,
    index: false,
  });
}

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
