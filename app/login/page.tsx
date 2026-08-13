import type { Metadata } from "next";
import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo";
import LoginForm from "./login-form";

export const metadata: Metadata = pageMetadata({
  title: "Staff login",
  description:
    "Sign in to the I5.04C Lab dashboard to review visitor requests, member hours, access logs, and door controls.",
  path: "/login",
});

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
