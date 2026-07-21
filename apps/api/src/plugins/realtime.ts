import { EventEmitter } from "node:events";

import fp from "fastify-plugin";

import type { App } from "../types/app.js";

/**
 * The server side of proposal §08: Postgres LISTEN/NOTIFY fanned out to every
 * connected SSE client.
 *
 * One dedicated LISTEN subscription per process (postgres.js manages the
 * actual connection internally when `.listen()` is called — see
 * apps/api/src/plugins/db.ts for why `pgClient`, not `db`, is used here).
 * Every reservation change anywhere triggers exactly one NOTIFY (migration
 * 0005's trigger); this plugin receives it once and republishes it to every
 * subscriber in this process via a plain EventEmitter.
 *
 * A small ring buffer of recent events makes `Last-Event-ID` replay possible:
 * a tablet that drops Wi-Fi for a minute reconnects and asks for everything
 * since the last id it saw, rather than silently missing whatever happened
 * in between (proposal §12, edge case E-15). The buffer lives in process
 * memory — it does not survive a restart, and multiple API instances would
 * each keep their own. Both are acceptable at this stage (a single instance,
 * per §15's current scale) and are exactly the kind of thing that motivates
 * moving to a durable queue if the API is ever run with more than one
 * replica; noted here rather than solved prematurely.
 */

export interface RealtimeEvent {
  id: number;
  payload: string;
}

declare module "fastify" {
  interface FastifyInstance {
    realtime: {
      /** Registers `onEvent` for every future notification, first replaying
       *  anything buffered after `sinceId` (pass `null` for a fresh
       *  connection with nothing to replay). Returns an unsubscribe
       *  function — callers must invoke it when the client disconnects, or
       *  the listener leaks for the life of the process. */
      subscribe(sinceId: number | null, onEvent: (event: RealtimeEvent) => void): () => void;
      /** How many clients are currently attached — surfaced on /health for
       *  operational visibility, and useful in tests. */
      subscriberCount(): number;
    };
  }
}

const RING_BUFFER_SIZE = 200;

export default fp(
  async function realtimePlugin(app: App) {
    const emitter = new EventEmitter();
    // Many SSE connections is the normal case (every open tablet/browser
    // tab), not a leak — the default warning threshold of 10 would fire
    // constantly otherwise.
    emitter.setMaxListeners(0);

    let nextId = 1;
    const buffer: RealtimeEvent[] = [];

    await app.pgClient.listen("reservation_changed", (payload) => {
      const event: RealtimeEvent = { id: nextId, payload };
      nextId += 1;

      buffer.push(event);
      if (buffer.length > RING_BUFFER_SIZE) buffer.shift();

      emitter.emit("event", event);
    });

    app.decorate("realtime", {
      subscribe(sinceId: number | null, onEvent: (event: RealtimeEvent) => void) {
        if (sinceId !== null) {
          for (const event of buffer) {
            if (event.id > sinceId) onEvent(event);
          }
        }
        emitter.on("event", onEvent);
        return () => emitter.off("event", onEvent);
      },
      subscriberCount() {
        return emitter.listenerCount("event");
      },
    });

    app.log.info("realtime LISTEN active on channel 'reservation_changed'");
  },
  { name: "realtime", dependencies: ["db"] },
);
