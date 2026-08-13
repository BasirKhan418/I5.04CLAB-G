"use client";

import { useEffect, useState } from "react";
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

export type EditableMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  notifyWhatsApp?: boolean;
};

export function EditMemberModal({
  member,
  open,
  onOpenChange,
  toast,
  canAssignSuperadmin = false,
  onSaved,
}: {
  member: EditableMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toast: (message: string, tone?: "ok" | "err") => void;
  canAssignSuperadmin?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"member" | "admin" | "superadmin">("member");
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!member || !open) return;
    setName(member.name);
    setEmail(member.email);
    setPhone(member.phone ?? "");
    setRole(
      member.role === "superadmin" || member.role === "admin"
        ? member.role
        : "member"
    );
    setNotifyWhatsApp(member.notifyWhatsApp ?? true);
    setError("");
  }, [member, open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setBusy(true);
    setError("");
    const res = await api(`/api/members/${member.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        email,
        phone,
        role,
        notifyWhatsApp,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    onOpenChange(false);
    toast("Member updated.");
    onSaved?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Edit member</DialogTitle>
          <DialogDescription>
            Update name, contact, role, and WhatsApp alerts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="mt-2 space-y-3">
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
              {role === "superadmin" ? (
                <option value="superadmin">Superadmin</option>
              ) : null}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={notifyWhatsApp}
              onChange={(e) => setNotifyWhatsApp(e.target.checked)}
            />
            WhatsApp alerts
          </label>
          {error ? <p className="text-sm text-lab-red">{error}</p> : null}
          <BrutalButton type="submit" loading={busy} className="w-full">
            Save changes
          </BrutalButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
