"use client";

import { useEffect, useRef, useState } from "react";
import {
  emptyDoorPresence,
  type DoorPresence,
} from "@/lib/door-presence-types";
import { api } from "@/lib/utils";

export type DoorPresenceView = DoorPresence & { live: boolean };

function applyPresence(
  current: DoorPresenceView,
  next: DoorPresence,
  live: boolean
): DoorPresenceView {
  return { ...current, ...next, live };
}

export function useDoorPresence(): DoorPresenceView {
  const [presence, setPresence] = useState<DoorPresenceView>({
    ...emptyDoorPresence(),
    live: false,
  });
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      const res = await api<DoorPresence>("/api/door/status");
      if (cancelled || !res.ok) return;
      setPresence((current) => applyPresence(current, res.data, current.live));
    }

    function clearTimer() {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleReconnect() {
      clearTimer();
      const wait = Math.min(1000 * 2 ** retryRef.current, 8000);
      retryRef.current += 1;
      timerRef.current = window.setTimeout(() => {
        if (!cancelled) connect();
      }, wait);
    }

    function connect() {
      if (cancelled) return;
      sourceRef.current?.close();
      const source = new EventSource("/api/door/stream");
      sourceRef.current = source;

      source.onopen = () => {
        retryRef.current = 0;
        setPresence((current) => ({ ...current, live: true }));
      };

      source.onmessage = (message) => {
        try {
          const next = JSON.parse(message.data) as DoorPresence;
          if (cancelled || typeof next.clients !== "number") return;
          setPresence((current) => applyPresence(current, next, true));
        } catch {
          /* ignore */
        }
      };

      source.onerror = () => {
        if (sourceRef.current !== source) return;
        setPresence((current) => ({ ...current, live: false }));
        source.close();
        sourceRef.current = null;
        void pull();
        scheduleReconnect();
      };
    }

    void pull();
    connect();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void pull();
    }, 10000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimer();
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, []);

  return presence;
}
