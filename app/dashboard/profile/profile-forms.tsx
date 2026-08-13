"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrutalButton, BrutalInput } from "@/components/brutal";
import { useAdminUi } from "@/components/admin-ui";
import { api } from "@/lib/utils";

export function ProfileForms({
  name,
  email,
  phone,
  mustChangePin,
}: {
  name: string;
  email: string;
  phone: string | null;
  mustChangePin: boolean;
}) {
  const router = useRouter();
  const { toast } = useAdminUi();
  const [displayName, setDisplayName] = useState(name);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPhone, setNewPhone] = useState(phone ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function changeName(e: React.FormEvent) {
    e.preventDefault();
    setBusy("name");
    setError("");
    setOk("");
    const res = await api<{ name: string }>("/api/profile/name", {
      method: "POST",
      body: JSON.stringify({ name: displayName }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    setDisplayName(res.data.name);
    setOk("Name updated.");
    toast("Name updated.");
    router.refresh();
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pin");
    setError("");
    setOk("");
    const res = await api("/api/profile/pin", {
      method: "POST",
      body: JSON.stringify({
        currentPin: mustChangePin ? undefined : currentPin,
        newPin,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    setOk("PIN updated.");
    toast("PIN updated.");
    setCurrentPin("");
    setNewPin("");
    router.refresh();
  }

  async function requestPhone() {
    setBusy("phone");
    setError("");
    setOk("");
    const res = await api("/api/profile/phone/request", {
      method: "POST",
      body: JSON.stringify({ phone: newPhone }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    setOtpSent(true);
    setOk("Code sent to email and the new WhatsApp number.");
    toast("Code sent.");
  }

  async function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setBusy("verify");
    setError("");
    setOk("");
    const res = await api("/api/profile/phone/verify", {
      method: "POST",
      body: JSON.stringify({ phone: newPhone, otp }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      toast(res.error, "err");
      return;
    }
    setOk("Number updated.");
    toast("Number updated.");
    setOtpSent(false);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div>
        <p className="font-heading text-2xl">{displayName}</p>
        <p className="text-sm text-ink/55">{email}</p>
      </div>

      {mustChangePin ? (
        <div className="rounded-2xl bg-lab-pale/70 px-4 py-3 text-sm">
          You still have the default PIN. Set your own when you can.
        </div>
      ) : null}

      <form
        onSubmit={changeName}
        className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <h2 className="font-medium">Name</h2>
        <label className="block text-xs font-medium text-ink/50">
          Display name
          <BrutalInput
            className="mt-1"
            name="name"
            autoComplete="name"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        <BrutalButton
          type="submit"
          loading={busy === "name"}
          disabled={Boolean(busy) || displayName.trim() === name}
        >
          Save name
        </BrutalButton>
      </form>

      <form
        onSubmit={changePin}
        className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <h2 className="font-medium">Change PIN</h2>
        {!mustChangePin ? (
          <label className="block text-xs font-medium text-ink/50">
            Current PIN
            <BrutalInput
              className="mt-1"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
            />
          </label>
        ) : null}
        <label className="block text-xs font-medium text-ink/50">
          New PIN (4–8 digits)
          <BrutalInput
            className="mt-1"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
        </label>
        <BrutalButton type="submit" loading={busy === "pin"} disabled={Boolean(busy)}>
          Save PIN
        </BrutalButton>
      </form>

      <form
        onSubmit={verifyPhone}
        className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <h2 className="font-medium">WhatsApp number</h2>
        <p className="text-sm text-ink/55">
          Optional. 10 digits; country code 91 is added.
        </p>
        <label className="block text-xs font-medium text-ink/50">
          Number
          <BrutalInput
            className="mt-1"
            placeholder="10-digit number"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel"
          />
        </label>
        {otpSent ? (
          <label className="block text-xs font-medium text-ink/50">
            Code
            <BrutalInput
              className="mt-1"
              placeholder="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
        ) : null}
        {otpSent ? (
          <BrutalButton type="submit" loading={busy === "verify"} disabled={Boolean(busy)}>
            Confirm number
          </BrutalButton>
        ) : (
          <BrutalButton
            type="button"
            loading={busy === "phone"}
            disabled={Boolean(busy)}
            onClick={requestPhone}
          >
            Update WhatsApp
          </BrutalButton>
        )}
      </form>

      {error ? <p className="text-sm text-lab-red">{error}</p> : null}
      {ok ? <p className="text-sm text-ink/70">{ok}</p> : null}
    </div>
  );
}
