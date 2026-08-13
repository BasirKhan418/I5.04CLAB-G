"use client";

import { useState } from "react";
import { BrutalButton } from "@/components/brutal";
import { useAdminUi } from "@/components/admin-ui";
import { VisitorMediaPeek } from "@/components/visitor-media-peek";
import { api } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export function PendingApprovals() {
  const { pending, refreshPending, toast } = useAdminUi();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "deny") {
    setBusyId(`${id}:${action}`);
    const res = await api("/api/gate/approve", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error, "err");
      return;
    }
    toast(action === "approve" ? "Visitor approved." : "Visitor denied.");
    await refreshPending();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink/50">Waiting at the door</p>
      {pending.length === 0 ? (
        <div className="rounded-[24px] border border-ink/10 bg-white px-4 py-5 text-sm text-ink/50">
          No one waiting.
        </div>
      ) : (
        pending.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-[24px] border-2 border-ink bg-white p-4 sm:flex-row sm:items-center"
          >
            <VisitorMediaPeek
              name={item.displayName}
              faceUrl={item.faceUrl}
              voiceUrl={item.voiceUrl}
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-medium break-words">{item.displayName}</p>
              <p className="text-sm text-ink/55 break-words">
                {item.reason || "No reason"} · {timeAgo(item.createdAt)}
              </p>
            </div>
            <div className="flex w-full justify-center gap-2 sm:w-auto sm:shrink-0">
              <BrutalButton
                type="button"
                variant="mint"
                className="flex-1 sm:flex-none"
                loading={busyId === `${item.id}:approve`}
                disabled={Boolean(busyId)}
                onClick={() => act(item.id, "approve")}
              >
                Approve
              </BrutalButton>
              <BrutalButton
                type="button"
                variant="white"
                className="flex-1 sm:flex-none"
                loading={busyId === `${item.id}:deny`}
                disabled={Boolean(busyId)}
                onClick={() => act(item.id, "deny")}
              >
                Deny
              </BrutalButton>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
