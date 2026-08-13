"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function FollowEyes({
  size = 64,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const max = size * 0.14;
    function aim(clientX: number, clientY: number) {
      const el = wrapRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      setLook({
        x: (dx / dist) * Math.min(max, dist / 28),
        y: (dy / dist) * Math.min(max, dist / 28),
      });
    }
    function onPointer(event: PointerEvent) {
      aim(event.clientX, event.clientY);
    }
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, [size]);

  return (
    <div
      ref={wrapRef}
      className={cn("inline-flex items-center", className)}
      style={{ gap: size * 0.12 }}
      aria-hidden
    >
      {[0, 1].map((i) => (
        <span
          key={i}
          className="relative shrink-0 overflow-hidden rounded-full border-2 border-ink bg-white shadow-[3px_3px_0_#111]"
          style={{ width: size, height: size }}
        >
          <span
            className="absolute rounded-full bg-ink"
            style={{
              width: size * 0.4,
              height: size * 0.4,
              left: "50%",
              top: "52%",
              transform: `translate(calc(-50% + ${look.x}px), calc(-50% + ${look.y}px))`,
              transition: "transform 70ms linear",
            }}
          >
            <span
              className="absolute rounded-full bg-white"
              style={{
                width: "32%",
                height: "32%",
                top: "16%",
                left: "20%",
              }}
            />
          </span>
        </span>
      ))}
    </div>
  );
}
