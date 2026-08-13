"use client";

import { useRef, useState } from "react";
import { BrutalButton } from "@/components/brutal";
import { cn } from "@/lib/utils";

export function KycCamera({
  onCapture,
}: {
  onCapture: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 720, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
    } catch {
      setError("Camera permission denied");
    } finally {
      setBusy(false);
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 480, 480);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "face.jpg", { type: "image/jpeg" });
        onCapture(file);
        setPreview(URL.createObjectURL(blob));
        stop();
      },
      "image/jpeg",
      0.9
    );
  }

  function clear() {
    setPreview(null);
    onCapture(null);
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative mx-auto overflow-hidden rounded-[999px] bg-lab-pale",
          preview || live
            ? "aspect-[3/4] w-36 border-2 border-ink sm:w-48"
            : "pointer-events-none h-px w-px opacity-0"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captured face" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
        )}
      </div>
      {error ? <p className="text-sm text-lab-red">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {!live && !preview ? (
          <BrutalButton soft type="button" variant="white" loading={busy} onClick={start}>
            Open camera
          </BrutalButton>
        ) : null}
        {live ? (
          <BrutalButton shine type="button" onClick={capture}>
            Capture face
          </BrutalButton>
        ) : null}
        {preview ? (
          <BrutalButton soft type="button" variant="white" onClick={clear}>
            Retake
          </BrutalButton>
        ) : null}
      </div>
    </div>
  );
}
