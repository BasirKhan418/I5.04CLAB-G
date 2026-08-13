import { jsonError, requireSession } from "@/lib/api";
import type { GateEvent } from "@/lib/gate-events";
import { subscribeGateEvents } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID = /^[a-f0-9]{24}$/i;

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId")?.trim() || null;
  if (requestId && !ID.test(requestId)) {
    return jsonError("Invalid request");
  }
  if (!requestId) {
    const auth = await requireSession();
    if ("response" in auth) {
      return auth.response;
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: GateEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          /* stream closed */
        }
      };

      send({ type: "hello" });

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* stream closed */
        }
      }, 15000);

      const stop = subscribeGateEvents((event) => {
        if (requestId) {
          if (event.type === "request" && event.id === requestId) {
            send(event);
          }
          return;
        }
        if (event.type === "pending") {
          send(event);
        }
      });

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
