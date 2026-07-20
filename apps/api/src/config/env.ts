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

  /**
   * Signs and verifies admin/staff login tokens.
   *
   * Interim auth — proposal §03 commits to Amazon Cognito, which needs an AWS
   * account the client has not yet provided (see project notes). This secret
   * disappears entirely once that migration happens; nothing about it is
   * meant to be long-lived infrastructure.
   *
   * No default in production: a guessable or shared signing secret lets
   * anyone mint an admin token. A default is allowed in development only, so
   * a fresh clone runs immediately without every contributor generating their
   * own — the built-in value is intentionally useless anywhere but a laptop.
   */
  JWT_SECRET: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(`\nEnvironment configuration is invalid:\n\n${issues}\n`);
  process.exit(1);
}

const data = parsed.data;

if (!data.JWT_SECRET) {
  if (data.NODE_ENV === "production") {
    console.error(
      "\nJWT_SECRET is required in production. Generate one with:\n\n  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n\nand set it in the hosting platform's environment variables.\n",
    );
    process.exit(1);
  }

  console.warn(
    "\n⚠  JWT_SECRET not set — using an insecure development-only default.\n   Never deploy with this default; production requires a real JWT_SECRET.\n",
  );
}

export const env = {
  ...data,
  JWT_SECRET: data.JWT_SECRET ?? "insecure-development-only-secret-do-not-deploy",
};
export type Env = typeof env;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
