import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LogsExplorer } from "./logs-explorer";

export const metadata: Metadata = pageMetadata({
  title: "Access logs",
  description:
    "Search I5.04C Lab member punches, visitor requests, and manual door opens.",
  path: "/dashboard/logs",
  index: false,
});

export default function LogsPage() {
  return <LogsExplorer />;
}
