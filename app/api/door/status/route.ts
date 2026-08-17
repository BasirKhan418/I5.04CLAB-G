import { jsonOk, requireSession } from "@/lib/api";
import { getDoorPresence } from "@/lib/door-presence";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  return jsonOk(await getDoorPresence());
}
