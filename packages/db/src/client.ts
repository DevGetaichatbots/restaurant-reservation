import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/** The raw postgres.js client. Exported because LISTEN/NOTIFY has no
 *  query-builder equivalent in Drizzle — the realtime layer calls
 *  `.listen()` on this directly rather than through `Database`. */
export type PgClient = ReturnType<typeof postgres>;

/**
 * Opens the connection pool.
 *
 * Called once per process. The API decorates its Fastify instance with the
 * result so every route shares one pool — see apps/api/src/plugins/db.ts.
 *
 * The pool is kept small on purpose. Neon's free tier allows only a modest
 * number of concurrent connections, and this service additionally holds one
 * dedicated connection open for LISTEN/NOTIFY, which is what drives the
 * real-time layer.
 */
export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Neon and Render both require TLS; a local server generally does not.
    ssl: connectionString.includes("localhost") ? false : "require",
  });

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    close: async () => {
      await client.end();
    },
  };
}
