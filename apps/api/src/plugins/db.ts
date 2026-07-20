import { createDatabase, type Database } from "@rms/db";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

/**
 * Database connection, shared by every route as `app.db`.
 *
 * Opened once at boot and closed on shutdown. Individual handlers never create
 * their own connection — that would exhaust the pool under load, and Neon's
 * free tier has a modest connection ceiling.
 */
export default fp(async function dbPlugin(app: FastifyInstance) {
  const { db, close } = createDatabase(env.DATABASE_URL);

  app.decorate("db", db);

  app.addHook("onClose", async () => {
    app.log.info("closing database connections");
    await close();
  });

  app.log.info("database connected");
});
