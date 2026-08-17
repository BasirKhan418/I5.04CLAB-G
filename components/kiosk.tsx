"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { FollowEyes } from "@/components/follow-eyes";
import {
  BrutalButton,
  BrutalCard,
  BrutalInput,
  BrutalTextarea,
} from "@/components/brutal";
import { KycCamera } from "@/components/kyc-camera";
import { VoiceRecorder } from "@/components/voice-recorder";
import { ConfettiBurst, GpayMark } from "@/components/gate-celebrate";
import {
  playDeniedSound,
  playGateCloseSound,
  playGateOpenSound,
  unlockKioskAudio,
} from "@/lib/kiosk-audio";
import {
  clearVisitorCache,
  readVisitorCache,
  writeVisitorCache,
  type VisitorWaitStatus,
} from "@/lib/kiosk-visitor-cache";
import { useGateStream } from "@/hooks/use-gate-stream";
import { api, cn } from "@/lib/utils";

type Member = {
  name: string;
  email: string;
  faceUrl: string | null;
  inside: boolean;
  enteredAt: string | null;
};

type Mode = "visitor" | "member" | null;
type Celebrate = "open" | "out" | "no" | null;

export function Kiosk() {
  const [mode, setMode] = useState<Mode>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [face, setFace] = useState<File | null>(null);
  const [voice, setVoice] = useState<File | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<VisitorWaitStatus | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [celebrate, setCelebrate] = useState<Celebrate>(null);
  const [confetti, setConfetti] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [extras, setExtras] = useState(false);
  const [booted, setBooted] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const celebratedRef = useRef(false);
  const draftTimer = useRef(0);

  useLayoutEffect(() => {
    const cache = readVisitorCache();
    if (cache) {
      setName(cache.name);
      setReason(cache.reason);
      setExtras(cache.extras);
      if (cache.requestId && cache.requestStatus) {
        setMode("visitor");
        setRequestId(cache.requestId);
        setRequestStatus(cache.requestStatus);
        if (
          cache.requestStatus === "approved" ||
          cache.requestStatus === "denied"
        ) {
          celebratedRef.current = true;
        }
      } else if (cache.onForm) {
        setMode("visitor");
      }
    }
    setBooted(true);
  }, []);

  async function resumeMember() {
    const res = await api<Member>("/api/gate/identify");
    if (!res.ok) {
      setSignedIn(false);
      return false;
    }
    setSignedIn(true);
    setMember(res.data);
    return true;
  }

  useEffect(() => {
    if (!booted) return;
    void resumeMember();
  }, [booted]);

  useEffect(() => {
    if (!booted) return;
    function persistDraft() {
      writeVisitorCache({
        onForm: mode === "visitor",
        name,
        reason,
        extras,
        requestId: null,
        requestStatus: null,
      });
    }
    if (requestId && requestStatus) {
      writeVisitorCache({
        onForm: false,
        name,
        reason: "",
        extras: false,
        requestId,
        requestStatus,
      });
      return;
    }
    window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(persistDraft, 400);
    function onHide() {
      window.clearTimeout(draftTimer.current);
      persistDraft();
    }
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearTimeout(draftTimer.current);
      window.removeEventListener("pagehide", onHide);
    };
  }, [booted, mode, name, reason, extras, requestId, requestStatus]);

  useEffect(() => {
    if (!member?.inside || !member.enteredAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [member?.inside, member?.enteredAt]);

  useEffect(() => {
    if (!requestId || requestStatus !== "pending") return;
    let cancelled = false;
    async function tick() {
      if (document.hidden) return;
      const res = await api<{ status: VisitorWaitStatus }>(
        `/api/gate/request/${requestId}`
      );
      if (cancelled) return;
      if (res.ok) {
        setRequestStatus(res.data.status);
        return;
      }
      if (res.error === "Request not found") {
        setRequestId(null);
        setRequestStatus(null);
      }
    }
    void tick();
    const timer = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [requestId, requestStatus]);

  useGateStream(
    Boolean(requestId && requestStatus === "pending"),
    requestId,
    (event) => {
      if (event.type === "request") {
        setRequestStatus(event.status);
      }
    }
  );

  useEffect(() => {
    if (requestStatus !== "approved" || celebratedRef.current) return;
    celebratedRef.current = true;
    setCelebrate("open");
    setConfetti(true);
    playGateOpenSound();
    const hide = window.setTimeout(() => setConfetti(false), 2200);
    return () => window.clearTimeout(hide);
  }, [requestStatus]);

  useEffect(() => {
    if (requestStatus !== "denied") return;
    if (celebratedRef.current) return;
    playDeniedSound();
    setCelebrate("no");
  }, [requestStatus]);

  function burst(kind: Celebrate, withConfetti: boolean) {
    setCelebrate(kind);
    if (withConfetti) {
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), 2200);
    }
    if (kind === "open") playGateOpenSound();
    if (kind === "out") playGateCloseSound();
    if (kind === "open" || kind === "out") {
      window.setTimeout(() => setCelebrate(null), 1600);
    }
  }

  async function sendOtp() {
    setBusy("otp");
    setError("");
    setOtpSent(true);
    setPin("");
    await unlockKioskAudio();
    const res = await api<{ email?: boolean; whatsapp?: boolean }>(
      "/api/auth/otp/request",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      }
    );
    setBusy(null);
    if (!res.ok) {
      setOtpSent(false);
      setOtpHint("");
      setError(res.error);
      return;
    }
    if (res.data.email && res.data.whatsapp) {
      setOtpHint("Code sent to email and WhatsApp.");
    } else if (res.data.whatsapp) {
      setOtpHint("Code sent to WhatsApp.");
    } else {
      setOtpHint("Code sent to email.");
    }
  }

  async function identify(e: React.FormEvent) {
    e.preventDefault();
    setBusy("identify");
    setError("");
    setMessage("");
    await unlockKioskAudio();
    const res = await api<Member>("/api/gate/identify", {
      method: "POST",
      body: JSON.stringify({
        email,
        pin: otpSent ? undefined : pin || undefined,
        otp: otp || undefined,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMember(res.data);
    setSignedIn(true);
  }

  async function enterOrExit(direction: "in" | "out") {
    setBusy(direction);
    setError("");
    setMessage("");
    await unlockKioskAudio();
    const res = await api<{
      direction: string;
      name: string;
      already?: boolean;
      at?: string;
    }>("/api/gate/allow", {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMember((prev) =>
      prev
        ? {
            ...prev,
            inside: direction === "in",
            enteredAt:
              direction === "in"
                ? new Date(res.data.at ?? Date.now()).toISOString()
                : null,
          }
        : prev
    );
    if (res.data.already) {
      setMessage(
        direction === "in"
          ? `${res.data.name} is already inside.`
          : `${res.data.name} is already out.`
      );
      return;
    }
    burst(direction === "in" ? "open" : "out", direction === "in");
    setMessage(
      direction === "in"
        ? `Welcome in, ${res.data.name}.`
        : `See you next time, ${res.data.name}.`
    );
  }

  function resetToStart() {
    clearVisitorCache();
    setMode(null);
    setMember(null);
    setRequestStatus(null);
    setRequestId(null);
    setCelebrate(null);
    setConfetti(false);
    celebratedRef.current = false;
    setName("");
    setReason("");
    setFace(null);
    setVoice(null);
    setFormKey((n) => n + 1);
    setExtras(false);
    setError("");
    setMessage("");
  }

  async function submitVisitor(e: React.FormEvent) {
    e.preventDefault();
    setBusy("visit");
    setError("");
    setMessage("");
    await unlockKioskAudio();
    const form = new FormData();
    form.set("name", name);
    form.set("reason", reason);
    if (face) form.set("face", face);
    if (voice) form.set("voice", voice);
    const res = await api<{ id: string; name: string; notified: number }>(
      "/api/gate/visit",
      { method: "POST", body: form }
    );
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    celebratedRef.current = false;
    setReason("");
    setFace(null);
    setVoice(null);
    setExtras(false);
    setRequestId(res.data.id);
    setRequestStatus("pending");
  }

  const initials = member
    ? member.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  const trackedLabel = (() => {
    if (!member?.inside || !member.enteredAt) return null;
    const ms = Math.max(0, now - new Date(member.enteredAt).getTime());
    const totalMinutes = Math.floor(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = Math.floor((ms % 60_000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (totalMinutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  })();

  const showMemberFlash =
    mode === "member" && member && (celebrate === "open" || celebrate === "out");

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <ConfettiBurst fire={confetti} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="float-blob absolute -left-16 top-10 size-48 rounded-full bg-lab-yellow/70 blur-2xl sm:size-64" />
        <div className="float-blob absolute -right-10 top-40 size-40 rounded-full bg-lab-pink/80 blur-2xl [animation-delay:-3s] sm:size-56" />
        <div className="float-blob absolute bottom-10 left-1/3 size-44 rounded-full bg-lab-mint/70 blur-2xl [animation-delay:-5s]" />
      </div>

      {showMemberFlash ? (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-cream/50">
          <GpayMark kind={celebrate === "out" ? "out" : "ok"} />
        </div>
      ) : null}

      <header className="relative z-10 mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 py-4 sm:max-w-xl">
        <Logo />
        <Link
          href="/dashboard"
          className="shrink-0 text-sm font-medium text-ink/50 underline-offset-4 hover:text-ink hover:underline"
        >
          Staff
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center px-4 pb-10 sm:max-w-xl">
        <h1 className="rise-in mt-8 text-center font-heading text-4xl leading-tight text-balance sm:mt-12 sm:text-5xl">
          {mode === "member" && member?.inside ? "Exit the lab" : "Enter the lab"}
        </h1>

        {!booted ? (
          <div className="mt-8 h-52 w-full" aria-hidden />
        ) : mode === null ? (
          <div className="rise-in mt-8 grid w-full gap-3">
            <p className="text-center text-sm text-ink/60">Who are you?</p>
            <button
              type="button"
              className="rounded-[28px] border-2 border-ink bg-white p-5 text-left shadow-[6px_6px_0_#111] transition-transform hover:-translate-y-0.5"
              onClick={() => {
                setMode("visitor");
                setError("");
                setMessage("");
              }}
            >
              <p className="font-heading text-2xl">I&apos;m visiting</p>
              <p className="mt-1 text-sm text-ink/55">
                Ask someone inside to let you in. No account.
              </p>
            </button>
            <button
              type="button"
              className="rounded-[28px] border-2 border-ink bg-lab-red p-5 text-left text-white shadow-[6px_6px_0_#111] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
              disabled={busy === "resume"}
              onClick={async () => {
                setError("");
                setMessage("");
                await unlockKioskAudio();
                if (member) {
                  setMode("member");
                  void resumeMember();
                  return;
                }
                setBusy("resume");
                await resumeMember();
                setBusy(null);
                setMode("member");
              }}
            >
              <p className="font-heading text-2xl">I work here</p>
              <p className="mt-1 text-sm text-white/80">
                {signedIn && member
                  ? `Continue as ${member.name}. ${member.inside ? "Exit when you leave." : "Enter when you arrive."}`
                  : "Sign in to Enter or Exit."}
              </p>
            </button>
          </div>
        ) : (
          <>
            {requestStatus === "approved" ? null : (
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-ink/50 underline-offset-4 hover:text-ink hover:underline"
              onClick={() => {
                setMode(null);
                setError("");
                setMessage("");
              }}
            >
              ← Not this — change
            </button>
            )}
            <BrutalCard className="rise-in mt-4 w-full p-5 sm:p-7">
          {mode === "member" && member ? (
            <div className="flex flex-col items-center text-center">
              <div className="aspect-[3/4] w-40 overflow-hidden rounded-[999px] border-2 border-ink bg-lab-pale sm:w-48">
                {member.faceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.faceUrl}
                    alt={member.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-heading text-5xl">
                    {initials}
                  </div>
                )}
              </div>
              <p className="mt-4 font-heading text-3xl">{member.name}</p>
              <p className="text-sm text-ink/60 break-all">{member.email}</p>
              <p className="mt-1 text-xs font-semibold tracking-widest text-ink/50 uppercase">
                {member.inside ? "currently in" : "currently out"}
              </p>
              <div className="mt-6 w-full">
                {member.inside ? (
                  <BrutalButton
                    shine
                    type="button"
                    variant="ink"
                    loading={busy === "out"}
                    disabled={Boolean(busy)}
                    className="w-full py-3"
                    onClick={() => enterOrExit("out")}
                  >
                    Exit
                  </BrutalButton>
                ) : (
                  <BrutalButton
                    shine
                    type="button"
                    variant="mint"
                    loading={busy === "in"}
                    disabled={Boolean(busy)}
                    className="w-full py-3"
                    onClick={() => enterOrExit("in")}
                  >
                    Enter
                  </BrutalButton>
                )}
              </div>
              {member.inside ? (
                <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-lab-mint px-4 py-3 text-sm font-medium">
                  <span className="btn-spinner relative z-10" aria-hidden />
                  <span>
                    Tracking this visit
                    {trackedLabel ? ` · ${trackedLabel}` : ""}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                className="mt-4 text-sm font-semibold text-ink/60 underline underline-offset-4"
                onClick={() => {
                  setMember(null);
                  setPin("");
                  setOtp("");
                  setOtpSent(false);
                  setMessage("");
                  setCelebrate(null);
                }}
              >
                Not you? Switch account
              </button>
            </div>
          ) : null}

          {mode === "member" && !member ? (
            <form onSubmit={identify} className="space-y-3">
              <p className="text-sm font-medium text-ink/55">
                Lab email and PIN.
              </p>
              <label className="block text-xs font-medium text-ink/50">
                Email
                <BrutalInput
                  className="mt-1"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {otpSent ? (
                <label className="block text-xs font-medium text-ink/50">
                  Email / WhatsApp code
                  <BrutalInput
                    className="mt-1"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    autoFocus
                  />
                  {otpHint ? (
                    <span className="mt-1 block text-xs font-normal text-ink/55">
                      {otpHint}
                    </span>
                  ) : null}
                </label>
              ) : (
                <label className="block text-xs font-medium text-ink/50">
                  PIN
                  <BrutalInput
                    className="mt-1"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </label>
              )}
              {otpSent ? null : (
                <BrutalButton
                  soft
                  type="button"
                  variant="white"
                  loading={busy === "otp"}
                  disabled={Boolean(busy) || !email}
                  className="w-full"
                  onClick={sendOtp}
                >
                  Send OTP to email and WhatsApp
                </BrutalButton>
              )}
              <BrutalButton
                shine
                type="submit"
                loading={busy === "identify"}
                disabled={Boolean(busy)}
                className="w-full"
              >
                Continue
              </BrutalButton>
            </form>
          ) : null}

          {mode === "visitor" ? (
            requestStatus === "pending" ? (
              <div className="text-center">
                <FollowEyes size={56} className="justify-center" />
                <h2 className="mt-3 font-heading text-3xl">Asking the lab</h2>
                <p className="mt-2 text-sm text-ink/70">
                  {name.trim() ? `${name.trim()}, hang tight.` : "Hang tight."}{" "}
                  Someone inside just got your request.
                </p>
                <div className="wait-bar mx-auto mt-5 w-44">
                  <span />
                </div>
              </div>
            ) : requestStatus === "approved" ? (
              <div className="text-center">
                <GpayMark kind="ok" />
                <h2 className="mt-4 font-heading text-3xl">You&apos;re in</h2>
                <p className="mt-2 text-sm text-ink/70">
                  Walk through. Welcome to I5.04C Lab.
                </p>
                <button
                  type="button"
                  className="mt-5 text-sm font-semibold text-ink/50 underline-offset-4 hover:text-ink hover:underline"
                  onClick={resetToStart}
                >
                  Ask again
                </button>
              </div>
            ) : requestStatus === "denied" ? (
              <div className="text-center">
                <GpayMark kind="no" />
                <h2 className="mt-4 font-heading text-3xl">Not this time</h2>
                <p className="mt-2 text-sm text-ink/70">
                  They couldn&apos;t let you in this time. You can send another
                  request.
                </p>
                <BrutalButton
                  shine
                  type="button"
                  className="mt-4"
                  onClick={() => {
                    setRequestStatus(null);
                    setRequestId(null);
                    setCelebrate(null);
                    celebratedRef.current = false;
                  }}
                >
                  Try again
                </BrutalButton>
              </div>
            ) : (
              <form onSubmit={submitVisitor} className="space-y-4">
                <p className="text-sm font-medium text-ink/55">
                  Name is enough. Tap Ask to come in.
                </p>
                <label className="block text-xs font-medium text-ink/50">
                  Your name
                  <BrutalInput
                    className="mt-1"
                    placeholder="Optional"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                {extras ? (
                  <>
                    <label className="block text-xs font-medium text-ink/50">
                      Why are you here?
                      <BrutalTextarea
                        className="mt-1"
                        rows={2}
                        placeholder="Optional"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <KycCamera key={`cam-${formKey}`} onCapture={setFace} />
                    <VoiceRecorder key={`mic-${formKey}`} onRecord={setVoice} />
                  </>
                ) : (
                  <div>
                    <p className="text-xs text-ink/45">
                      Optional extras for quicker access — a reason, photo, or
                      voice helps people inside recognise you.
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-sm font-semibold text-ink/50 underline-offset-4 hover:text-ink hover:underline"
                      onClick={() => setExtras(true)}
                    >
                      Add reason, photo, or voice
                    </button>
                  </div>
                )}
                <BrutalButton
                  shine
                  type="submit"
                  loading={busy === "visit"}
                  disabled={Boolean(busy)}
                  className="w-full"
                >
                  Ask to come in
                </BrutalButton>
              </form>
            )
          ) : null}

          {error ? (
            <p className="mt-4 text-sm font-medium text-lab-red">{error}</p>
          ) : null}
          {message && requestStatus !== "approved" && requestStatus !== "pending" ? (
            <p
              className={cn(
                "mt-4 rounded-2xl bg-lab-mint p-3 text-sm font-medium"
              )}
            >
              {message}
            </p>
          ) : null}
        </BrutalCard>
          </>
        )}
      </main>
    </div>
  );
}
