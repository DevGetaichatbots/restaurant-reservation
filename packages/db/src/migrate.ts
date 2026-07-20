import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

/**
 * Migration runner.
 *
 * Applies every .sql file in ./migrations in filename order, once each, inside
 * a transaction. Applied files are recorded in `_migrations` so re-running is
 * safe.
 *
 * Migrations are hand-written SQL rather than generated. Two things this schema
 * depends on cannot be expressed through an ORM:
 *
 *   • a GENERATED column computing each booking's time range
 *   • an EXCLUDE constraint using that range to make double-booking impossible
 *
 * Writing the SQL directly keeps those visible and reviewable in a pull
 * request, which is exactly where a rule this important should be readable.
 */
const migrationsDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }

  const target = connectionString.includes("localhost") ? "local" : "remote";
  console.log(`Migrating the ${target} database…\n`);

  const sql = postgres(connectionString, {
    max: 1,
    ssl: connectionString.includes("localhost") ? false : "require",
  });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename    text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `;

    const applied = new Set(
      (await sql<{ filename: string }[]>`SELECT filename FROM _migrations`).map(
        (row) => row.filename,
      ),
    );

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

    let count = 0;

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`  ·  ${filename} (already applied)`);
        continue;
      }

      const contents = await readFile(join(migrationsDir, filename), "utf8");

      // Each migration is one transaction: it either lands whole or not at all,
      // so a failure halfway can never leave a half-built schema behind.
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO _migrations (filename) VALUES (${filename})`;
      });

      console.log(`  ✓  ${filename}`);
      count += 1;
    }

    console.log(
      count === 0 ? "\nNothing to do — schema is up to date." : `\nApplied ${count} migration(s).`,
    );
  } catch (error) {
    console.error("\nMigration failed:\n", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
