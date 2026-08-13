import { jsonOk } from "@/lib/api";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();
  return jsonOk({ signedOut: true });
}
