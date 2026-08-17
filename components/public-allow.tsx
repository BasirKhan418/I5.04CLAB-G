"use client";

import { useState } from "react";
import { Logo } from "@/components/brand";
import { KioskDoorStatus } from "@/components/door-status";
import { BrutalButton, BrutalCard } from "@/components/brutal";
import { ConfettiBurst, GpayMark } from "@/components/gate-celebrate";
import { playDeniedSound, playGateOpenSound, unlockKioskAudio } from "@/lib/kiosk-audio";
import { doorDeliveryNote } from "@/lib/door-delivery";
import { api } from "@/lib/utils";

export function PublicAllow({
  token,
  name,
  reason,
  status: initial,
}: {
  token: string;
  name: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
}) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [error, setError] = useState("");
  const [doorNote, setDoorNote] = useState("");

  async function act(action: "allow" | "deny") {
    setBusy(true);
    setError("");
    await unlockKioskAudio();
    const res = await api<{
      status: "pending" | "approved" | "denied";
      already?: boolean;
      pulsed?: boolean;
      name: string;
      door?: { status: "sent" | "queued"; online: boolean };
    }>("/api/gate/public-allow", {
      method: "POST",
      body: JSON.stringify({ token, action }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStatus(res.data.status);
    if (res.data.status === "approved") {
      setDoorNote(doorDeliveryNote(res.data.door));
      setConfetti(true);
      playGateOpenSound();
      window.setTimeout(() => setConfetti(false), 2200);
    }
    if (res.data.status === "denied") {
      playDeniedSound();
    }
  }

  return (
    <div className="relative min-h-dvh">
      <ConfettiBurst fire={confetti} />
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-4">
        <Logo href="/" />
        <KioskDoorStatus />
      </header>
      <main className="mx-auto w-full max-w-md px-4 pb-10">
        <BrutalCard className="mt-8 p-6 text-center sm:p-8">
          {status === "approved" ? (
            <>
              <GpayMark kind="ok" />
              <h1 className="mt-4 font-heading text-3xl">You&apos;re in</h1>
              <p className="mt-2 text-sm text-ink/70">
                {doorNote || `Door opening for ${name}.`}
              </p>
              <BrutalButton
                shine
                className="mt-6 w-full"
                loading={busy}
                onClick={() => act("allow")}
              >
                Allow again
              </BrutalButton>
            </>
          ) : status === "denied" ? (
            <>
              <GpayMark kind="no" />
              <h1 className="mt-4 font-heading text-3xl">Not this time</h1>
              <p className="mt-2 text-sm text-ink/70">{name} was denied.</p>
              <BrutalButton
                shine
                className="mt-6 w-full"
                loading={busy}
                onClick={() => act("allow")}
              >
                Allow anyway
              </BrutalButton>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-widest text-ink/45 uppercase">
                Door request
              </p>
              <h1 className="mt-2 font-heading text-3xl">{name}</h1>
              {reason ? (
                <p className="mt-2 text-sm text-ink/60">{reason}</p>
              ) : (
                <p className="mt-2 text-sm text-ink/60">Waiting outside the lab.</p>
              )}
              <BrutalButton
                shine
                className="mt-6 w-full"
                loading={busy}
                onClick={() => act("allow")}
              >
                Allow
              </BrutalButton>
              <button
                type="button"
                className="mt-4 text-sm font-semibold text-ink/45 underline-offset-4 hover:text-ink hover:underline"
                disabled={busy}
                onClick={() => act("deny")}
              >
                Deny
              </button>
            </>
          )}
          {error ? (
            <p className="mt-4 text-sm font-medium text-lab-red">{error}</p>
          ) : null}
        </BrutalCard>
      </main>
    </div>
  );
}
