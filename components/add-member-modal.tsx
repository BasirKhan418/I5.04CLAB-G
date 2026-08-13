"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrutalButton, BrutalInput } from "@/components/brutal";
import { api } from "@/lib/utils";

export function AddMemberModal({
  open,
  onOpenChange,
  toast,
  canAssignSuperadmin = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toast: (message: string, tone?: "ok" | "err") => void;
  canAssignSuperadmin?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"member" | "admin" | "superadmin">("member");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await api<{ emailed: boolean; warning?: string }>(
      "/api/members",
      {
        method: "POST",
        body: JSON.stringify({ name, email, phone, role }),
      }
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    setName("");
    setEmail("");
    setPhone("");
    setRole("member");
    onOpenChange(false);
    toast(
      res.data.emailed
        ? "Member added. PIN emailed."
        : res.data.warning ?? "Member added."
    );
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Add member</DialogTitle>
          <DialogDescription>
            They can sign in with email. Optional WhatsApp, 10 digits.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={addMember} className="mt-2 space-y-3">
          <label className="block text-xs font-medium text-ink/50">
            Name
            <BrutalInput
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
          <label className="block text-xs font-medium text-ink/50">
            Email
            <BrutalInput
              className="mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block text-xs font-medium text-ink/50">
            WhatsApp (optional)
            <BrutalInput
              className="mt-1"
              placeholder="10 digits"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoComplete="tel"
            />
          </label>
          <label className="block text-xs font-medium text-ink/50">
            Role
            <select
              className="mt-1 h-11 w-full min-w-0 rounded-lg border border-ink/15 bg-white px-3.5 text-sm outline-none transition focus:border-ink/40"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "member" | "admin" | "superadmin")
              }
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              {canAssignSuperadmin ? (
                <option value="superadmin">Superadmin</option>
              ) : null}
            </select>
          </label>
          {error ? <p className="text-sm text-lab-red">{error}</p> : null}
          <BrutalButton type="submit" loading={busy} className="w-full">
            Add member
          </BrutalButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
