import { connectDB } from "@/lib/db";
import { jsonError, requireSession } from "@/lib/api";
import { AccessLog } from "@/models/AccessLog";
import { getObject } from "@/lib/s3";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "face" && kind !== "voice") {
    return jsonError("Invalid media kind");
  }

  const { id } = await context.params;
  await connectDB();
  const log = await AccessLog.findById(id).select("faceKey voiceKey");
  const key = kind === "face" ? log?.faceKey : log?.voiceKey;
  if (!log || !key) {
    return jsonError("Media not found", 404);
  }

  try {
    const file = await getObject(key);
    return new Response(file.stream, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
        ...(file.contentLength
          ? { "Content-Length": String(file.contentLength) }
          : {}),
      },
    });
  } catch {
    return jsonError("Could not load media", 404);
  }
}
