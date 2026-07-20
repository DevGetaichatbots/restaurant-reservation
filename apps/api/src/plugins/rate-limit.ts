import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

/**
 * Request throttling.
 *
 * The booking endpoint is public and unauthenticated — anyone who finds the URL
 * can post to it. This is the baseline defence against a bot filling every
 * table with junk reservations (proposal §12, edge cases E-17 and E-35).
 *
 * These are global defaults. Individual routes tighten them further; creating a
 * reservation is far stricter than reading availability.
 */
export default fp(async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",

    // The SSE stream is one long-lived request that stays open for hours.
    // Counting it as traffic would throttle a tablet for simply staying
    // connected, so it is excluded.
    allowList: (request) => request.url.startsWith("/events"),

    errorResponseBuilder: () => ({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please wait a moment and try again.",
      },
    }),
  });
});
