import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client.js";

/**
 * Applies pending migrations, then exits.
 *
 * Run against the local database during development and as a release step
 * before the API starts in staging and production. Drizzle records which
 * migrations have already run, so this is safe to run repeatedly.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }

  const target = connectionString.includes("localhost") ? "local" : "remote";
  console.log(`Running migrations against the ${target} database…`);

  const { db, close } = createDatabase(connectionString);

  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migrations applied.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}

void main();
