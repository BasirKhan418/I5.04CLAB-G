import mongoose from "mongoose";
import { getEnv } from "@/lib/env";
import { Settings } from "@/models/Settings";
import { User } from "@/models/User";

export type OpenwaConfig = {
  apiUrl: string;
  sessionId: string;
  templateId: string;
  apiKey: string;
};

export type OpenwaPublic = {
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

function emptyConfig(): OpenwaConfig {
  return { apiUrl: "", sessionId: "", templateId: "", apiKey: "" };
}

function fromEnv(): OpenwaConfig {
  const env = getEnv();
  return {
    apiUrl: env.openwaApiUrl,
    sessionId: env.openwaSessionId,
    templateId: env.openwaTemplateId,
    apiKey: env.openwaApiKey,
  };
}

function normalize(config: OpenwaConfig): OpenwaConfig {
  return {
    apiUrl: config.apiUrl.replace(/\/$/, "").trim(),
    sessionId: config.sessionId.trim(),
    templateId: config.templateId.trim(),
    apiKey: config.apiKey.trim(),
  };
}

export function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 10) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function openwaMissing(config: OpenwaConfig) {
  const missing: string[] = [];
  if (!config.apiUrl) missing.push("API URL");
  if (!config.sessionId) missing.push("Session ID");
  if (!config.apiKey) missing.push("API key");
  return missing;
}

async function ensureMongo() {
  if (mongoose.connection.readyState === 1) return;
  const { connectDB } = await import("@/lib/db");
  await connectDB();
}

export async function getOpenwaConfig(): Promise<OpenwaConfig> {
  await ensureMongo();
  const doc = await Settings.findOne({ key: "lab" });
  const stored = doc?.openwa;
  const seeded = normalize({
    apiUrl: stored?.apiUrl || "",
    sessionId: stored?.sessionId || "",
    templateId: stored?.templateId || "",
    apiKey: stored?.apiKey || "",
  });
  if (seeded.apiUrl || seeded.sessionId || seeded.apiKey) {
    return seeded;
  }
  return normalize(fromEnv());
}

export async function seedOpenwaFromEnv() {
  await ensureMongo();
  const existing = await Settings.findOne({ key: "lab" });
  if (existing?.openwa?.apiKey || existing?.openwa?.sessionId) {
    return existing;
  }
  const seed = normalize(fromEnv());
  if (!seed.apiUrl && !seed.sessionId && !seed.apiKey) {
    return existing;
  }
  if (existing) {
    existing.openwa = seed;
    await existing.save();
    return existing;
  }
  return Settings.create({ key: "lab", openwa: seed });
}

export async function getOpenwaPublic(): Promise<OpenwaPublic> {
  const doc = await seedOpenwaFromEnv();
  const config = await getOpenwaConfig();
  const missing = openwaMissing(config);
  let updatedByName: string | null = null;
  if (doc?.updatedBy) {
    const user = await User.findById(doc.updatedBy).select("name");
    updatedByName = user?.name ?? null;
  }
  return {
    apiUrl: config.apiUrl,
    sessionId: config.sessionId,
    templateId: config.templateId,
    hasApiKey: Boolean(config.apiKey),
    apiKeyMasked: maskSecret(config.apiKey),
    ready: missing.length === 0,
    missing,
    updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
    updatedByName,
  };
}

export async function saveOpenwaConfig(
  next: Partial<OpenwaConfig>,
  userId: string
) {
  await ensureMongo();
  const current = await getOpenwaConfig();
  const merged = normalize({
    apiUrl: next.apiUrl ?? current.apiUrl,
    sessionId: next.sessionId ?? current.sessionId,
    templateId: next.templateId ?? current.templateId,
    apiKey: next.apiKey?.trim() ? next.apiKey : current.apiKey,
  });
  const doc = await Settings.findOneAndUpdate(
    { key: "lab" },
    { openwa: merged, updatedBy: userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { config: merged, doc };
}

export function assertOpenwaReady(config: OpenwaConfig) {
  const missing = openwaMissing(config);
  if (missing.length) {
    throw new Error(
      `WhatsApp is not set up (${missing.join(", ")}). Add it under Infrastructure.`
    );
  }
}
