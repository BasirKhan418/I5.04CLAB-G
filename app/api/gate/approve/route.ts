import { z } from "zod";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { decideVisitorRequest } from "@/lib/gate-decide";

const bodySchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "deny"]),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Pick a request to approve or deny");
  }

  const result = await decideVisitorRequest({
    id: parsed.data.id,
    action: parsed.data.action,
    actorId: auth.session.sub,
  });
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }
  return jsonOk({
    id: result.id,
    status: result.status,
    already: result.already,
    door: "door" in result ? result.door : undefined,
  });
}
