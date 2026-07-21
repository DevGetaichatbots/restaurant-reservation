import { env } from "../../config/env.js";
import type { App } from "../../types/app.js";

/**
 * The SSE stream every front-end subscribes to — proposal §08.
 *
 * Deliberately public: guests need live availability on the booking page
 * without logging in. What travels over this connection is the thin,
 * non-identifying payload the NOTIFY trigger emits (an id, a status, a
 * date) — never guest details. Anything a client needs beyond that comes
 * from a normal authenticated REST call made *because* of the event, not
 * from the event itself (see the trigger's comment in migration 0005 for
 * why that split matters).
 *
 * This route bypasses Fastify's normal response lifecycle entirely via
 * `reply.hijack()`, because the whole point is to keep writing to the same
 * connection for hours — Fastify's own send/serialize pipeline assumes one
 * response per request and would either buffer or close early. That also
 * means the CORS plugin's usual header-setting never reaches this response
 * (its hooks fire against the lifecycle we just opted out of), so the CORS
 * header below is set by hand from the same origin allowlist.
 */
export default async function eventsRoutes(app: App) {
  app.get("/", { schema: { tags: ["realtime"], summary: "Live event stream (Server-Sent Events)" } }, async (request, reply) => {
    const origin = request.headers.origin;
    const allowedOrigin = origin && env.CORS_ORIGINS.includes(origin) ? origin : undefined;

    reply.hijack();

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Render and most reverse proxies buffer responses by default, which
      // would hold every event until the buffer filled — defeating the
      // entire point of a live stream.
      "X-Accel-Buffering": "no",
    };
    if (allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = allowedOrigin;
      headers["Vary"] = "Origin";
    }

    reply.raw.writeHead(200, headers);
    // The client already knows it's connected once bytes arrive; this also
    // pushes past any intermediary that waits for a first byte before
    // treating the connection as open.
    reply.raw.write(":ok\n\n");

    const lastEventIdHeader = request.headers["last-event-id"];
    const sinceId =
      typeof lastEventIdHeader === "string" && lastEventIdHeader.length > 0 ? Number(lastEventIdHeader) : null;

    const send = (event: { id: number; payload: string }) => {
      reply.raw.write(`id: ${event.id}\n`);
      reply.raw.write("event: reservation_changed\n");
      reply.raw.write(`data: ${event.payload}\n\n`);
    };

    const unsubscribe = app.realtime.subscribe(sinceId, send);

    // Keeps the connection alive through proxies/load balancers that close
    // an idle connection after a short timeout, and gives the client a
    // steady signal the stream is still healthy.
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
  });
}
