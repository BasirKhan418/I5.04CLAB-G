"use client";

import { useRef } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { useAdminUi } from "@/components/admin-ui";
import { cn } from "@/lib/utils";
import { useCamStream, type CamStatus } from "@/hooks/use-cam-stream";

const labels: Record<CamStatus, string> = {
  connecting: "Waiting for camera…",
  live: "Live",
  idle: "Live",
  offline: "Waiting for camera…",
  error: "Sign in required",
};

export function DashboardCameraPreview() {
  const { door } = useAdminUi();
  if (!door.online) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-medium text-ink/50">Door camera</p>
        <Link
          href="/dashboard/camera"
          className="text-sm font-semibold text-lab-red"
        >
          Full view
        </Link>
      </div>
      <LiveCamera compact />
    </div>
  );
}

export function LiveCamera({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { door } = useAdminUi();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { status, hasFrame } = useCamStream(door.online, canvasRef);

  if (!door.online) {
    if (compact) return null;
    return (
      <p className="text-sm text-ink/50">
        Door is offline. The camera preview shows only when a board is connected.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden border-2 border-ink bg-ink",
        compact ? "rounded-2xl" : "rounded-[28px]",
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full">
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            hasFrame ? "opacity-100" : "opacity-0"
          )}
        />
        {!hasFrame ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
            <Camera className="size-8" />
            <p className="text-sm font-medium">{labels[status]}</p>
          </div>
        ) : null}
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase",
            status === "live"
              ? "bg-lab-red text-white"
              : "bg-white/90 text-ink"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "live" ? "animate-pulse bg-white" : "bg-ink/40"
            )}
          />
          {labels[status]}
        </span>
      </div>
    </div>
  );
}
