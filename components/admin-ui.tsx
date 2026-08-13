"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AddMemberModal } from "@/components/add-member-modal";
import { DoorOpenModal } from "@/components/door-open-modal";
import { useGateStream } from "@/hooks/use-gate-stream";
import { api, cn } from "@/lib/utils";

export type PendingItem = {
  id: string;
  displayName: string;
  reason: string | null;
  createdAt: string;
  faceUrl: string | null;
  voiceUrl: string | null;
};

type ToastTone = "ok" | "err";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type AdminUi = {
  isAdmin: boolean;
  isSuperadmin: boolean;
  openAddMember: () => void;
  openDoor: () => void;
  pending: PendingItem[];
  pendingCount: number;
  refreshPending: () => Promise<void>;
  toast: (message: string, tone?: ToastTone) => void;
};

const AdminUiContext = createContext<AdminUi | null>(null);

export function useAdminUi() {
  const ctx = useContext(AdminUiContext);
  if (!ctx) {
    throw new Error("useAdminUi must be used inside AdminUiProvider");
  }
  return ctx;
}

export function AdminUiProvider({
  isAdmin,
  isSuperadmin = false,
  children,
}: {
  isAdmin: boolean;
  isSuperadmin?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const openAddMember = useCallback(() => setOpen(true), []);
  const openDoor = useCallback(() => setDoorOpen(true), []);

  const refreshPending = useCallback(async () => {
    const res = await api<PendingItem[]>("/api/gate/pending");
    if (res.ok) {
      setPending(
        res.data.map((item) => ({
          ...item,
          createdAt:
            typeof item.createdAt === "string"
              ? item.createdAt
              : new Date(item.createdAt).toISOString(),
          reason: item.reason ?? null,
        }))
      );
    }
  }, []);

  useEffect(() => {
    void refreshPending();
    const timer = window.setInterval(() => {
      void refreshPending();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshPending]);

  useGateStream(true, null, (event) => {
    if (event.type === "pending") {
      void refreshPending();
    }
  });

  const toast = useCallback((message: string, tone: ToastTone = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  return (
    <AdminUiContext.Provider
      value={{
        isAdmin,
        isSuperadmin,
        openAddMember,
        openDoor,
        pending,
        pendingCount: pending.length,
        refreshPending,
        toast,
      }}
    >
      {children}
      {isAdmin ? (
        <AddMemberModal
          open={open}
          onOpenChange={setOpen}
          toast={toast}
          canAssignSuperadmin={false}
        />
      ) : null}
      <DoorOpenModal open={doorOpen} onOpenChange={setDoorOpen} toast={toast} />
      <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(100%-2rem,20rem)] flex-col gap-2">
        {toasts.map((item) => (
          <p
            key={item.id}
            className={cn(
              "pointer-events-auto rounded-2xl border-2 border-ink bg-white px-4 py-3 text-sm font-medium",
              item.tone === "err" && "border-lab-red"
            )}
          >
            {item.message}
          </p>
        ))}
      </div>
    </AdminUiContext.Provider>
  );
}
