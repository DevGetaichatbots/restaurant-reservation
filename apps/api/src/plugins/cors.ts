import cors from "@fastify/cors";
import fp from "fastify-plugin";

import { env } from "../config/env.js";
import type { App } from "../types/app.js";

/**
 * Cross-origin access.
 *
 * The three front-ends live on separate subdomains, so every browser call to
 * this API is cross-origin. We allow exactly the origins listed in
 * CORS_ORIGINS and nothing else — a wildcard here would let any website on the
 * internet call the API with a logged-in admin's cookies attached.
 */
export default fp(async function corsPlugin(app: App) {
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  app.log.info({ origins: env.CORS_ORIGINS }, "CORS configured");
});
