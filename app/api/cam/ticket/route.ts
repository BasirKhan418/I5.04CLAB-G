import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api";
import { signCamTicket } from "@/lib/jwt";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }
  try {
    const ticket = await signCamTicket(auth.session.sub);
    return NextResponse.json(
      { ok: true, data: { ticket } },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch {
    return jsonError("Camera ticket failed", 500);
  }
}
