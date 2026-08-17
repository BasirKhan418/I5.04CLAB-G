import { jsonOk } from "@/lib/api";
import { getDoorPresence, publicDoorPresence } from "@/lib/door-presence";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk(publicDoorPresence(await getDoorPresence()));
}
