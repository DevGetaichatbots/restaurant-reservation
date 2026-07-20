import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * Migrations are generated as plain, versioned SQL files under ./migrations.
 * They are committed to the repository and reviewed like any other code —
 * which matters here because several of them contain hand-written SQL that an
 * ORM cannot express, above all the exclusion constraint that makes
 * double-booking impossible.
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
