import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { User } from "@/models/User";
import { redirect } from "next/navigation";
import { ProfileForms } from "./profile-forms";

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
