import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";
import { redirect } from "next/navigation";
import { ProfileForms } from "./profile-forms";

export const metadata: Metadata = pageMetadata({
  title: "Profile",
  description:
    "Update your I5.04C Lab name, phone, and PIN for kiosk check-in.",
  path: "/dashboard/profile",
  index: false,
});

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  await connectDB();
  const user = await User.findById(session.sub);
  if (!user) redirect("/login");

  return (
    <ProfileForms
      name={user.name}
      email={user.email}
      phone={user.phone ?? null}
      mustChangePin={user.mustChangePin}
    />
  );
}
