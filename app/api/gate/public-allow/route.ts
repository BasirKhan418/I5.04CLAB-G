import { jsonError, jsonOk } from "@/lib/api";
import { verifyAllowToken } from "@/lib/allow-link";
import { publicDoorAllow, publicDoorDeny } from "@/lib/gate-decide";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function limited(ip: string) {
  const key = `public-allow:${ip}`;
  const n = await getRedis().incr(key);
  if (n === 1) await getRedis().expire(key, 60);
  return n > 20;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  if (await limited(ip)) {
    return jsonError("Too many tries. Wait a moment.", 429);
  }

  const body = (await request.json().catch(() => null)) as {
    token?: string;
    action?: string;
  } | null;
  const token = body?.token?.trim() ?? "";
  const id = verifyAllowToken(token);
  if (!id) {
    return jsonError("This link is not valid", 404);
  }

  if (body?.action === "deny") {
    const result = await publicDoorDeny(id);
    if (!result.ok) return jsonError(result.error, result.status ?? 400);
    return jsonOk({
      status: result.status,
      already: result.already,
      name: result.name,
    });
  }

  const result = await publicDoorAllow(id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk({
    status: result.status,
    already: result.already,
    pulsed: result.pulsed,
    name: result.name,
    door: result.door,
  });
}
