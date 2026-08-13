"use client";

import { useEffect, useRef } from "react";
import type { GateEvent } from "@/lib/gate-events";

export function useGateStream(
  active: boolean,
  requestId: string | null | undefined,
  onEvent: (event: Extract<GateEvent, { type: "request" | "pending" }>) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!active) return;
    const qs = requestId ? `?requestId=${encodeURIComponent(requestId)}` : "";
    const source = new EventSource(`/api/gate/stream${qs}`);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as GateEvent;
        if (event.type === "request" || event.type === "pending") {
          onEventRef.current(event);
        }
      } catch {
        /* ignore */
      }
    };
    return () => source.close();
  }, [active, requestId]);
}
