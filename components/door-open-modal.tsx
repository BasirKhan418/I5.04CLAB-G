"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrutalButton, BrutalTextarea } from "@/components/brutal";
import { api } from "@/lib/utils";

export function DoorOpenModal({
  open,
  onOpenChange,
  toast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toast: (message: string, tone?: "ok" | "err") => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await api("/api/gate/open", {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    setReason("");
    onOpenChange(false);
    toast("Door opening.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 border-ink bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Open the door</DialogTitle>
          <DialogDescription>
            For when nobody is on the kiosk. Reason is saved in logs. Hours are
            not counted.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-3">
          <label className="block text-xs font-medium text-ink/50">
            Why are you opening it?
            <BrutalTextarea
              className="mt-1"
              rows={3}
              required
              minLength={2}
              placeholder="Courier, forgot badge, test…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm font-medium text-lab-red">{error}</p>
          ) : null}
          <BrutalButton
            shine
            type="submit"
            className="w-full"
            loading={busy}
            disabled={reason.trim().length < 2}
          >
            Allow
          </BrutalButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
