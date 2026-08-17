"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useDoorPresenceStream,
  type DoorPresenceView,
} from "@/hooks/use-door-presence";

const DoorPresenceContext = createContext<DoorPresenceView | null>(null);

export function DoorPresenceProvider({ children }: { children: ReactNode }) {
  const door = useDoorPresenceStream();
  return (
    <DoorPresenceContext.Provider value={door}>
      {children}
    </DoorPresenceContext.Provider>
  );
}

export function useDoorPresence(): DoorPresenceView {
  const door = useContext(DoorPresenceContext);
  if (!door) {
    throw new Error("useDoorPresence must be used inside DoorPresenceProvider");
  }
  return door;
}
