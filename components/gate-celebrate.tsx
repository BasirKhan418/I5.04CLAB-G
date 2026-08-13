"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const CONFETTI = ["#FF4D40", "#FFE566", "#9EE6C8", "#FFC2D4", "#111111", "#FFF9F2"];

export function GpayMark({
  kind = "ok",
  size = 104,
  className,
}: {
  kind?: "ok" | "out" | "no";
  size?: number;
  className?: string;
}) {
  const fill = kind === "ok" ? "#12b76a" : kind === "out" ? "#111111" : "#FF4D40";
  return (
    <div
      className={cn("gpay-mark mx-auto", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 52 52" className="size-full">
        <circle cx="26" cy="26" r="25" fill={fill} />
        {kind === "no" ? (
          <path
            className="gpay-stroke"
            d="M18 18 L34 34 M34 18 L18 34"
          />
        ) : (
          <path className="gpay-stroke" d="M15 27 l8 8 14-16" />
        )}
      </svg>
    </div>
  );
}

export function ConfettiBurst({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const pieces = Array.from({ length: 90 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * 80,
      y: height * 0.38,
      vx: (Math.random() - 0.5) * 14,
      vy: -8 - Math.random() * 10,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    }));

    const gravity = 0.28;
    let frame = 0;
    let raf = 0;

    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frame += 1;
      if (frame < 96) {
        raf = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [fire]);

  if (!fire) return null;

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden
    />
  );
}
