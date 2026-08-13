import { z } from "zod";
import { jsonError, jsonOk, requireAdmin } from "@/lib/api";
import { connectDB } from "@/lib/db";
import {
  getOpenwaConfig,
  getOpenwaPublic,
  saveOpenwaConfig,
} from "@/lib/openwa-config";

const bodySchema = z.object({
  apiUrl: z.string().trim().min(8, "API URL is required").max(200),
  sessionId: z.string().trim().min(8, "Session ID is required").max(80),
  templateId: z.string().trim().max(80).optional().default(""),
  apiKey: z.string().trim().max(200).optional().default(""),
});

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  await connectDB();
  const reveal = new URL(request.url).searchParams.get("reveal") === "1";
  const pub = await getOpenwaPublic();
  if (!reveal) {
    return jsonOk(pub);
  }

  const config = await getOpenwaConfig();
  return jsonOk({ ...pub, apiKey: config.apiKey || null });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Check the fields");
  }

  try {
    new URL(parsed.data.apiUrl);
  } catch {
    return jsonError("API URL must be a full https address");
  }

  await connectDB();
  const current = await getOpenwaConfig();
  if (!parsed.data.apiKey && !current.apiKey) {
    return jsonError("API key is required");
  }

  await saveOpenwaConfig(parsed.data, auth.session.sub);
  return jsonOk(await getOpenwaPublic());
}
