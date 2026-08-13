"use client";

import { useRef, useState } from "react";
import { BrutalButton } from "@/components/brutal";

export function VoiceRecorder({
  onRecord,
}: {
  onRecord: (file: File | null) => void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [hasClip, setHasClip] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], "voice.webm", { type: blob.type });
        onRecord(file);
        setHasClip(true);
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
    setHasClip(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink/50">Voice note · optional</p>
      {error ? <p className="text-sm text-lab-red">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {!recording && !hasClip ? (
          <BrutalButton soft type="button" variant="white" loading={busy} onClick={start}>
            Record voice
          </BrutalButton>
        ) : null}
        {recording ? (
          <BrutalButton shine type="button" onClick={stop}>
            Stop
          </BrutalButton>
        ) : null}
        {hasClip ? (
          <BrutalButton soft type="button" variant="white" onClick={clear}>
            Remove clip
          </BrutalButton>
        ) : null}
      </div>
      {hasClip ? (
        <p className="text-sm text-ink/70">Voice note attached (optional).</p>
      ) : null}
    </div>
  );
}
