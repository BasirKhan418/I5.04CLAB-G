"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { BrutalButton, BrutalInput } from "@/components/brutal";
import { useAdminUi } from "@/components/admin-ui";
import { timeAgo } from "@/lib/format";
import { api, cn } from "@/lib/utils";

type Infra = {
  apiUrl: string;
  sessionId: string;
  templateId: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  ready: boolean;
  missing: string[];
  updatedAt: string | null;
  updatedByName: string | null;
};

const empty: Infra = {
  apiUrl: "",
  sessionId: "",
  templateId: "",
  hasApiKey: false,
  apiKeyMasked: "",
  ready: false,
  missing: ["API URL", "Session ID", "API key"],
  updatedAt: null,
  updatedByName: null,
};

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url || "—";
  }
}

export function InfrastructureForm() {
  const { toast } = useAdminUi();
  const [saved, setSaved] = useState<Infra>(empty);
  const [apiUrl, setApiUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    api<Infra>("/api/admin/infrastructure").then((res) => {
      setLoading(false);
      if (!res.ok) {
        toast(res.error, "err");
        return;
      }
      setSaved(res.data);
      setApiUrl(res.data.apiUrl);
      setSessionId(res.data.sessionId);
      setTemplateId(res.data.templateId);
    });
  }, [toast]);

  const preview = useMemo(() => {
    const keyOnFile = Boolean(apiKey.trim()) || saved.hasApiKey;
    const missing = [
      !apiUrl.trim() && "API URL",
      !sessionId.trim() && "Session ID",
      !keyOnFile && "API key",
    ].filter(Boolean) as string[];
    return {
      host: hostOf(apiUrl.trim()),
      session: sessionId.trim() || "—",
      template: templateId.trim(),
      keyOnFile,
      missing,
      ready: missing.length === 0,
    };
  }, [apiUrl, sessionId, templateId, apiKey, saved.hasApiKey]);

  const keyChanged = revealedKey
    ? apiKey.trim() !== revealedKey
    : Boolean(apiKey.trim());
  const dirty =
    apiUrl.trim() !== saved.apiUrl ||
    sessionId.trim() !== saved.sessionId ||
    templateId.trim() !== saved.templateId ||
    keyChanged;

  async function revealKey() {
    if (revealedKey) {
      setShowKey((open) => !open);
      return;
    }
    if (peeking) return;
    setPeeking(true);
    const res = await api<Infra & { apiKey: string | null }>(
      "/api/admin/infrastructure?reveal=1"
    );
    setPeeking(false);
    if (!res.ok) {
      toast(res.error, "err");
      return;
    }
    if (res.data.apiKey) {
      setRevealedKey(res.data.apiKey);
      setApiKey(res.data.apiKey);
    }
    setShowKey(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await api<Infra>("/api/admin/infrastructure", {
      method: "PUT",
      body: JSON.stringify({
        apiUrl,
        sessionId,
        templateId,
        apiKey,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error, "err");
      return;
    }
    setSaved(res.data);
    setApiUrl(res.data.apiUrl);
    setSessionId(res.data.sessionId);
    setTemplateId(res.data.templateId);
    setApiKey("");
    setRevealedKey("");
    setShowKey(false);
    toast("WhatsApp settings saved. Worker will use them on the next notify.");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      <p className="text-sm text-ink/60">
        WhatsApp for visitor alerts. Stored in Mongo — change the session here
        when OpenWA reconnects. No redeploy, no worker restart.
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          onSubmit={save}
          className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">OpenWA</h2>
              <p className="mt-0.5 text-sm text-ink/50">
                Same values the worker uses to send.
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                preview.ready
                  ? "bg-lab-mint/80 text-ink"
                  : "bg-lab-red/10 text-lab-red"
              )}
            >
              {loading ? "…" : preview.ready ? "Ready" : "Needs setup"}
            </span>
          </div>

          <label className="block text-xs font-medium text-ink/50">
            API URL
            <BrutalInput
              className="mt-1"
              type="url"
              required
              placeholder="https://wapi.example.com/api"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="block text-xs font-medium text-ink/50">
            Session ID
            <BrutalInput
              className="mt-1 font-mono text-[13px]"
              required
              placeholder="OpenWA session UUID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="block text-xs font-medium text-ink/50">
            Template ID
            <BrutalInput
              className="mt-1 font-mono text-[13px]"
              placeholder="Optional — falls back to plain text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="block text-xs font-medium text-ink/50">
            API key
            <span className="relative mt-1 block">
              <BrutalInput
                className="pr-12 font-mono text-[13px]"
                type={showKey ? "text" : "password"}
                placeholder={
                  saved.hasApiKey
                    ? "Saved · leave blank to keep · click eye to show"
                    : "Paste the OpenWA API key"
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => void revealKey()}
                className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink/50 hover:bg-ink/5 hover:text-ink"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </span>
          </label>

          <BrutalButton
            shine
            type="submit"
            className="w-full sm:w-auto"
            loading={busy}
            disabled={loading || !dirty}
          >
            Save
          </BrutalButton>
        </form>

        <aside className="min-w-0 space-y-3 lg:sticky lg:top-20">
          <div className="overflow-hidden rounded-2xl border-2 border-ink bg-white p-5 shadow-[6px_6px_0_#111]">
            <p className="text-[11px] font-semibold tracking-wide text-ink/45 uppercase">
              Live preview
            </p>
            <p className="mt-2 font-heading text-2xl">
              {preview.ready ? "Worker can send" : "Not ready"}
            </p>
            <p className="mt-1 text-sm text-ink/55">
              {preview.ready
                ? "Next visitor ping uses these values from Mongo."
                : `Still need ${preview.missing.join(", ")}.`}
            </p>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="min-w-0">
                <dt className="text-ink/45">API URL</dt>
                <dd className="mt-0.5 break-all font-medium">{preview.host}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-ink/45">Session ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs">
                  {preview.session}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-ink/45">Template ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs">
                  {preview.template || "Text fallback"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-ink/45">API key</dt>
                <dd className="mt-0.5">
                  <button
                    type="button"
                    onClick={() => void revealKey()}
                    className="inline-flex max-w-full items-center gap-1.5 font-mono text-xs font-medium underline decoration-ink/20 underline-offset-2 hover:decoration-ink"
                  >
                    <span className="min-w-0 truncate">
                      {saved.apiKeyMasked ||
                        (preview.keyOnFile ? "••••••••" : "Not set")}
                    </span>
                    {preview.keyOnFile ? (
                      showKey ? (
                        <EyeOff className="size-3.5 shrink-0" />
                      ) : (
                        <Eye className="size-3.5 shrink-0" />
                      )
                    ) : null}
                  </button>
                </dd>
              </div>
            </dl>

            <ol className="mt-4 space-y-1.5 border-t border-ink/10 pt-3 text-xs text-ink/55">
              <li>1. Template or text</li>
              <li>2. Face photo, if they sent one</li>
              <li>3. Voice note, if they recorded</li>
              <li>4. Public Allow link</li>
            </ol>
          </div>

          <p className="px-1 text-xs text-ink/45">
            {saved.updatedAt
              ? `Last saved ${timeAgo(saved.updatedAt)}${
                  saved.updatedByName ? ` by ${saved.updatedByName}` : ""
                }.`
              : "Not saved in Mongo yet. First save copies what is here."}
          </p>
        </aside>
      </div>
    </div>
  );
}
