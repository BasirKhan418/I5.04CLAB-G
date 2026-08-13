import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Lab gate",
  description: "I5.04C Lab gate kiosk has moved to the home page.",
  path: "/",
  index: false,
});

export default function GatePage() {
  redirect("/");
}
