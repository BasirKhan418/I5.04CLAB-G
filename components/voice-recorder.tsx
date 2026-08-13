"use client";

import { useEffect, useRef, useState } from "react";
import { BrutalButton } from "@/components/brutal";

function pickAudioType() {
  const types = [
    "audio/ogg;codecs=opus",
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "audio/webm";
}

export function VoiceRecorder({
  onRecord,
}: {
  onRecord: (file: File | null) => void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipUrlRef = useRef<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    };
  }, []);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("ogg")
          ? "ogg"
          : type.includes("mp4")
            ? "m4a"
            : "webm";
        const file = new File([blob], `voice.${ext}`, { type });
        if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
        const url = URL.createObjectURL(blob);
        clipUrlRef.current = url;
        setClipUrl(url);
        onRecord(file);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone permission denied");
    } finally {
      setBusy(false);
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function clear() {
    onRecord(null);
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    clipUrlRef.current = null;
    setClipUrl(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink/50">Voice note · optional</p>
      {error ? <p className="text-sm text-lab-red">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {!recording && !clipUrl ? (
          <BrutalButton soft type="button" variant="white" loading={busy} onClick={start}>
            Record voice
          </BrutalButton>
        ) : null}
        {recording ? (
          <BrutalButton shine type="button" onClick={stop}>
            Stop
          </BrutalButton>
        ) : null}
        {clipUrl ? (
          <BrutalButton soft type="button" variant="white" onClick={clear}>
            Remove clip
          </BrutalButton>
        ) : null}
      </div>
      {clipUrl ? (
        <audio className="w-full" controls src={clipUrl} />
      ) : null}
    </div>
  );
}
