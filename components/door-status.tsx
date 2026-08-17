"use client";

import { BrutalCard } from "@/components/brutal";
import { useAdminUi } from "@/components/admin-ui";
import { useDoorPresence } from "@/components/door-presence-provider";
import { cn } from "@/lib/utils";
import type { DoorPresence } from "@/lib/door-presence-types";

function deviceLabel(count: number) {
  return count === 1 ? "1 device" : `${count} devices`;
}

export function DoorStatusCard() {
  const { door } = useAdminUi();
  const status = !door.ready
    ? "…"
    : !door.configured
      ? "Not set"
      : door.online
        ? "Online"
        : "Offline";

  return (
    <BrutalCard className="p-3 sm:p-4">
      <p className="text-[11px] font-semibold tracking-wide text-ink/45 uppercase">
        Door lock
      </p>
      <p className="mt-1 flex items-center gap-2 font-heading text-2xl sm:text-3xl">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            door.online ? "bg-lab-mint" : "bg-ink/25"
          )}
          aria-hidden
        />
        {status}
      </p>
      <p className="mt-1 text-sm text-ink/50">
        {!door.configured
          ? "Add DOOR_DEVICE_TOKEN to connect boards."
          : door.online
            ? `${deviceLabel(door.clients)} on this token`
            : "No board on this websocket"}
      </p>
    </BrutalCard>
  );
}

export function DoorStatusMark({
  door,
  className,
}: {
  door: Pick<DoorPresence, "online" | "clients" | "configured"> & {
    ready?: boolean;
  };
  className?: string;
}) {
  const status = !door.ready
    ? "Door · …"
    : !door.configured
      ? "Door · —"
      : door.online
        ? `Door · Online · ${door.clients}`
        : "Door · Offline";

  return (
    <p
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-xs text-ink/45",
        className
      )}
      title={
        !door.ready
          ? "Checking door lock"
          : door.online
            ? `${deviceLabel(door.clients)} connected`
            : "Door lock is offline"
      }
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          !door.ready
            ? "bg-ink/20"
            : door.online
              ? "bg-lab-mint"
              : "bg-ink/25"
        )}
        aria-hidden
      />
      <span className="sm:hidden">
        {!door.ready ? "…" : door.online ? "Online" : "Offline"}
      </span>
      <span className="hidden sm:inline">{status}</span>
    </p>
  );
}

export function DoorStatusPill() {
  const { door } = useAdminUi();
  return <DoorStatusMark door={door} />;
}

export function KioskDoorStatus() {
  const door = useDoorPresence();
  return <DoorStatusMark door={door} />;
}
