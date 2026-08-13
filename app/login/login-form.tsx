"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { BrutalButton, BrutalCard, BrutalInput } from "@/components/brutal";
import { api } from "@/lib/utils";

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function withPin(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pin");
    setError("");
    const res = await api<{ mustChangePin: boolean }>("/api/auth/pin", {
      method: "POST",
      body: JSON.stringify({ email, pin }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(res.data.mustChangePin ? "/dashboard/profile" : next);
    router.refresh();
  }

  async function sendOtp() {
    setBusy("otp");
    setError("");
    setOtpSent(true);
    setPin("");
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

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy("verify");
    setError("");
    const res = await api<{ mustChangePin: boolean }>("/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(res.data.mustChangePin ? "/dashboard/profile" : next);
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <Logo />
      <BrutalCard className="mt-8 w-full max-w-md p-8">
        <p className="text-sm font-semibold text-lab-red">no public signup</p>
        <h1 className="mt-1 font-heading text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-ink/70">
          Use the PIN from your welcome email, or a one-time code.
        </p>

        <form onSubmit={otpSent ? verifyOtp : withPin} className="mt-6 space-y-3">
          <BrutalInput
            type="email"
            required
            placeholder="lab email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {otpSent ? (
            <BrutalInput
              inputMode="numeric"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoFocus
            />
          ) : (
            <BrutalInput
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          )}
          {otpSent ? (
            <BrutalButton shine
              type="submit"
              loading={busy === "verify"}
              disabled={Boolean(busy)}
              className="w-full"
            >
              Verify code
            </BrutalButton>
          ) : (
            <BrutalButton shine
              type="submit"
              loading={busy === "pin"}
              disabled={Boolean(busy)}
              className="w-full"
            >
              Sign in with PIN
            </BrutalButton>
          )}
        </form>

        {otpSent ? null : (
          <>
            <div className="my-6 h-px bg-ink/10" />
            <BrutalButton shine
              type="button"
              variant="white"
              loading={busy === "otp"}
              disabled={Boolean(busy) || !email}
              className="w-full"
              onClick={sendOtp}
            >
              Send OTP to email and WhatsApp
            </BrutalButton>
          </>
        )}

        {otpHint && !error ? (
          <p className="mt-4 text-sm text-ink/70">{otpHint}</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-lab-red">{error}</p> : null}
        <p className="mt-6 text-center text-sm">
          Forgot a card?{" "}
          <Link href="/" className="font-semibold underline">
            Use the kiosk
          </Link>
        </p>
      </BrutalCard>
    </div>
  );
}
