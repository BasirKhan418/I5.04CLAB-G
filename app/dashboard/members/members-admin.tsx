"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrutalButton, BrutalInput } from "@/components/brutal";
import { useAdminUi } from "@/components/admin-ui";
import { StatusPill } from "@/components/status-pill";
import { api } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  inside: boolean;
  hoursToday: string;
};

export function MembersAdmin({
  me,
  members,
}: {
  me: string;
  members: Member[];
}) {
  const router = useRouter();
  const { openAddMember, toast } = useAdminUi();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const confirmMember = members.find((member) => member.id === confirmId);
  const shown = members.filter((member) => {
    const hay = `${member.name} ${member.email} ${member.phone ?? ""}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  async function remove() {
    if (!confirmId) return;
    setRemoving(confirmId);
    const res = await api(`/api/members/${confirmId}`, { method: "DELETE" });
    setRemoving(null);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    toast(`${confirmMember?.name ?? "Member"} removed.`);
    setConfirmId(null);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink/60">
          Roster. View opens that person’s hours and day log.
        </p>
        <BrutalButton type="button" onClick={openAddMember} className="w-full sm:w-auto">
          Add member
        </BrutalButton>
      </div>

      <label className="block text-xs font-medium text-ink/50 sm:max-w-sm">
        Search
        <BrutalInput
          className="mt-1"
          placeholder="Name, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {error ? <p className="text-sm text-lab-red">{error}</p> : null}

      {shown.length === 0 ? (
        <p className="text-sm text-ink/50">No members match that search.</p>
      ) : null}

      <div className="space-y-3 md:hidden">
        {shown.map((member) => (
          <div
            key={member.id}
            className="rounded-[24px] border border-ink/10 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{member.name}</p>
                <p className="truncate text-xs text-ink/50">{member.email}</p>
                <p className="mt-1 text-xs text-ink/45">
                  {member.phone || "No phone"} · {member.role}
                </p>
              </div>
              <ViewLink id={member.id} name={member.name} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <StatusPill inside={member.inside} />
              <span className="text-sm">Today {member.hoursToday}</span>
            </div>
            {member.id !== me && member.role !== "superadmin" ? (
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-lab-red"
                onClick={() => setConfirmId(member.id)}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[24px] border border-ink/10 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-lab-pale">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Today</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {shown.map((member) => (
                <tr key={member.id} className="border-t border-ink/10">
                  <td className="px-4 py-3">
                    <p className="font-medium">{member.name}</p>
                    <StatusPill inside={member.inside} className="mt-1" />
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <p>{member.email}</p>
                    <p className="text-xs text-ink/45">{member.phone || "No phone"}</p>
                  </td>
                  <td className="px-4 py-3">{member.hoursToday}</td>
                  <td className="px-4 py-3 capitalize">{member.role}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ViewLink id={member.id} name={member.name} />
                      {member.id !== me && member.role !== "superadmin" ? (
                        <button
                          type="button"
                          className="rounded-full px-3 py-1 text-sm text-lab-red hover:bg-lab-red/10"
                          onClick={() => setConfirmId(member.id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(confirmId)} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              {confirmMember
                ? `${confirmMember.name} will lose dashboard access.`
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <BrutalButton
              type="button"
              variant="white"
              onClick={() => setConfirmId(null)}
            >
              Cancel
            </BrutalButton>
            <BrutalButton
              type="button"
              loading={Boolean(removing)}
              onClick={remove}
            >
              Remove
            </BrutalButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ViewLink({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={`/dashboard/members/${id}`}
      className="inline-flex h-8 items-center rounded-full border-2 border-ink bg-white px-3 text-sm font-semibold"
      aria-label={`View ${name}`}
    >
      View
    </Link>
  );
}
