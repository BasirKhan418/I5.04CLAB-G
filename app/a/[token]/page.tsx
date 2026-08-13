import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { verifyAllowToken } from "@/lib/allow-link";
import { AccessLog } from "@/models/AccessLog";
import { PublicAllow } from "@/components/public-allow";
import { pageMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const id = verifyAllowToken(token);
  if (!id) {
    return pageMetadata({
      title: "Visitor request",
      description: "Approve or deny an I5.04C Lab visitor request.",
      path: `/a/${token}`,
      index: false,
    });
  }

  await connectDB();
  const log = await AccessLog.findById(id).select("displayName kind");
  const name = log?.kind === "visitor" ? log.displayName : "Visitor";

  return pageMetadata({
    title: `${name} wants in`,
    description: `Review ${name}'s visitor request for I5.04C Lab and approve or deny door access.`,
    path: `/a/${token}`,
    index: false,
  });
}

export default async function PublicAllowPage({ params }: PageProps) {
  const { token } = await params;
  const id = verifyAllowToken(token);
  if (!id) notFound();

  await connectDB();
  const log = await AccessLog.findById(id).select(
    "kind displayName status reason createdAt"
  );
  if (!log || log.kind !== "visitor") notFound();

  const age = Date.now() - new Date(log.createdAt).getTime();
  if (age > 8 * 60 * 60 * 1000) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4">
        <p className="font-heading text-3xl">Link expired</p>
        <p className="mt-2 text-sm text-ink/60">Ask them to send a new request.</p>
      </main>
    );
  }

  return (
    <PublicAllow
      token={token}
      name={log.displayName}
      reason={log.reason}
      status={log.status as "pending" | "approved" | "denied"}
    />
  );
}
