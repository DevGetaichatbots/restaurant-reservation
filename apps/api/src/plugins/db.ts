import { createDatabase, type Database, type PgClient } from "@rms/db";
import fp from "fastify-plugin";

import { env } from "../config/env.js";
import type { App } from "../types/app.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    /** The raw postgres.js client behind `db` — needed by the realtime
     *  plugin, which calls `.listen()` directly rather than through Drizzle
     *  (LISTEN/NOTIFY has no query-builder equivalent). Route handlers
     *  should use `db`, not this, for everything else. */
    pgClient: PgClient;
  }
}

/**
 * Database connection, shared by every route as `app.db`.
 *
 * Opened once at boot and closed on shutdown. Individual handlers never create
 * their own connection — that would exhaust the pool under load, and Neon's
 * free tier has a modest connection ceiling.
 */
export default fp(
  async function dbPlugin(app: App) {
    const { db, client, close } = createDatabase(env.DATABASE_URL);

    app.decorate("db", db);
    app.decorate("pgClient", client);

    app.addHook("onClose", async () => {
      app.log.info("closing database connections");
      await close();
    });

    app.log.info("database connected");
  },
  { name: "db" },
);
