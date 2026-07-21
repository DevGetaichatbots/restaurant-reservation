import { sql } from "drizzle-orm";
import { z } from "zod";

import type { App } from "../../types/app.js";

/**
 * Health checks.
 *
 * This is the first thing deployed and the last thing to change. Render polls
 * `/health` to decide whether the service is alive; if it starts failing, the
 * platform stops routing traffic here.
 *
 * Two levels deliberately:
 *   /health       — is the process up? (cheap, no database)
 *   /health/ready — can it actually serve? (touches the database)
 *
 * A process can be running while the database is unreachable. Only the second
 * check would notice, and only it should gate real traffic.
 */
export default async function healthRoutes(app: App) {
  app.get(
    "/",
    {
      schema: {
        tags: ["health"],
        summary: "Liveness — is the process running?",
        response: {
          200: z.object({
            status: z.literal("ok"),
            service: z.string(),
            version: z.string(),
            uptime: z.number().describe("Seconds since the process started"),
            timestamp: z.string(),
          }),
        },
      },
    },
    async () => ({
      status: "ok" as const,
      service: "rms-api",
      version: "0.1.0",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }),
  );

  app.get(
    "/realtime",
    {
      schema: {
        tags: ["health"],
        summary: "Live-event stream status",
        response: {
          200: z.object({
            status: z.literal("ok"),
            connectedClients: z.number().int(),
          }),
        },
      },
    },
    async () => ({ status: "ok" as const, connectedClients: app.realtime.subscriberCount() }),
  );

  app.get(
    "/ready",
    {
      schema: {
        tags: ["health"],
        summary: "Readiness — can it reach the database?",
        response: {
          200: z.object({
            status: z.literal("ready"),
            database: z.object({
              connected: z.literal(true),
              latencyMs: z.number(),
            }),
          }),
          503: z.object({
            status: z.literal("not_ready"),
            database: z.object({ connected: z.literal(false) }),
          }),
        },
      },
    },
    async (request, reply) => {
      const startedAt = Date.now();

      try {
        await app.db.execute(sql`select 1`);

        return {
          status: "ready" as const,
          database: { connected: true as const, latencyMs: Date.now() - startedAt },
        };
      } catch (error) {
        request.log.error({ err: error }, "readiness check failed");

        return reply
          .status(503)
          .send({ status: "not_ready" as const, database: { connected: false as const } });
      }
    },
  );
}
