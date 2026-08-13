"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function VisitorMediaPeek({
  name,
  faceUrl,
  voiceUrl,
}: {
  name: string;
  faceUrl: string | null;
  voiceUrl: string | null;
}) {
  const [open, setOpen] = useState<"face" | "voice" | null>(null);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-start">
        {faceUrl ? (
          <button
            type="button"
            className="size-14 shrink-0 overflow-hidden rounded-full border-2 border-ink"
            onClick={() => setOpen("face")}
            aria-label={`View photo of ${name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faceUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-cream font-heading text-lg">
            {initials}
          </div>
        )}
        {voiceUrl ? (
          <button
            type="button"
            className="rounded-full border border-ink/20 bg-cream px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-ink/40 hover:text-ink"
            onClick={() => setOpen("voice")}
          >
            Play voice
          </button>
        ) : null}
      </div>

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      >
        <DialogContent className="border-2 border-ink bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              {open === "voice" ? "Voice note" : "Photo"}
            </DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>
          {open === "face" && faceUrl ? (
            <div className="overflow-hidden rounded-[24px] border-2 border-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faceUrl} alt={name} className="w-full object-cover" />
            </div>
          ) : null}
          {open === "voice" && voiceUrl ? (
            <audio
              key={voiceUrl}
              className="w-full"
              controls
              autoPlay
              src={voiceUrl}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
