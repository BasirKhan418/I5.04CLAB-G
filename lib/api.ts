import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import { User } from "@/models/User";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function requireSession(): Promise<
  { session: SessionPayload } | { response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { response: jsonError("Sign in required", 401) };
  }
  return { session };
}

export async function requireAdmin(): Promise<
  { session: SessionPayload } | { response: NextResponse }
> {
  const result = await requireSession();
  if ("response" in result) {
    return result;
  }
  if (result.session.role !== "admin" && result.session.role !== "superadmin") {
    return { response: jsonError("Admin only", 403) };
  }
  return result;
}

export async function loadUser(id: string) {
  await connectDB();
  return User.findById(id);
}
