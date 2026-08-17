import { jsonOk } from "@/lib/api";
import { getDoorPresence } from "@/lib/door-presence";

export const dynamic = "force-dynamic";

export async function GET() {
  const presence = await getDoorPresence();
  return jsonOk({
    online: presence.online,
    clients: presence.clients,
    configured: presence.configured,
    updatedAt: presence.updatedAt,
  });
}
