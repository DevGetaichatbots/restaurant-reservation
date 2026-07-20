import { join } from "node:path";
import { fileURLToPath } from "node:url";

import autoload from "@fastify/autoload";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import { env, isDevelopment } from "./config/env.js";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * Builds the Fastify instance.
 *
 * Nothing is registered by hand. Two directories are scanned at boot:
 *
 *   plugins/  — cross-cutting concerns (database, CORS, error handling, docs).
 *               Loaded first, so every module can rely on them.
 *
 *   modules/  — one folder per feature (tables, reservations, availability…).
 *               Any file ending in `.routes.ts` is picked up automatically and
 *               mounted under a URL prefix taken from its folder name.
 *
 * Adding a feature therefore means creating a folder — never editing this file.
 * That is what keeps the wiring readable as the API grows to dozens of routes.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Pretty, human-readable logs while developing; structured JSON in
      // production so the hosting platform can parse and index them.
      transport: isDevelopment
        ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
        : undefined,
    },
    // Render and other proxies terminate TLS upstream. Without this the API
    // sees the proxy's IP for every request, which would break rate limiting.
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod schemas on a route now validate the request AND describe the response
  // in the generated OpenAPI document. One definition, both jobs.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(autoload, {
    dir: join(here, "plugins"),
    forceESM: true,
  });

  await app.register(autoload, {
    dir: join(here, "modules"),
    matchFilter: (path) => path.endsWith(".routes.js") || path.endsWith(".routes.ts"),
    dirNameRoutePrefix: true,
    forceESM: true,
  });

  return app;
}
