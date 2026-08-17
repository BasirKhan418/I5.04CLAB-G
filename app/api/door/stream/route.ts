import { jsonError } from "@/lib/api";
import {
  getDoorPresence,
  publicDoorPresence,
  subscribeDoorPresence,
  type DoorPresence,
} from "@/lib/door-presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let snapshot: DoorPresence;
  try {
    snapshot = await getDoorPresence();
  } catch {
    return jsonError("Door status unavailable", 503);
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (presence: DoorPresence) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(publicDoorPresence(presence))}\n\n`
            )
          );
        } catch {
          /* stream closed */
        }
      };

      send(snapshot);

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* stream closed */
        }
      }, 15000);

      const stop = subscribeDoorPresence(send);

      const abort = () => {
        clearInterval(ping);
        stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
