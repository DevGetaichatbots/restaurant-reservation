import { z } from "zod";

/**
 * Environment configuration.
 *
 * Every value the API depends on is declared and validated here, once, at boot.
 * If something is missing or malformed the process exits immediately with a
 * readable message — rather than failing later inside a request handler where
 * the cause is much harder to see.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(4000),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required — copy .env.example to .env and fill it in"),

  /**
   * The restaurant's IANA timezone (e.g. "Asia/Karachi").
   *
   * Every booking rule is evaluated against this zone, never against the
   * browser's clock. A guest booking from another country must still get
   * the restaurant's 7:30 PM. See proposal §12, edge case E-01.
   */
  RESTAURANT_TIMEZONE: z.string().min(1).default("Asia/Karachi"),

  /** Comma-separated list of origins allowed to call this API. */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(`\nEnvironment configuration is invalid:\n\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
