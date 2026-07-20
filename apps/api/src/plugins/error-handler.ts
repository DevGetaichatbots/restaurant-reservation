import fp from "fastify-plugin";
import { ZodError } from "zod";

import { AppError } from "../lib/errors.js";
import { isProduction } from "../config/env.js";
import type { App } from "../types/app.js";

/**
 * The single place an error becomes an HTTP response.
 *
 * Route handlers throw; they never build error payloads themselves. That keeps
 * the shape identical across every endpoint, which matters because all three
 * front-ends parse it with the same code.
 *
 * Response shape:
 *   { error: { code, message, details? } }
 */
export default fp(async function errorHandlerPlugin(app: App) {
  app.setErrorHandler((error, request, reply) => {
    // Request body or query failed a Zod schema.
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_FAILED",
          message: "Some of the details you entered aren't valid.",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    // A rule we threw deliberately — safe to show the guest.
    if (error instanceof AppError) {
      request.log.info({ code: error.code }, error.message);
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    // PostgreSQL 23P01 = exclusion_violation.
    //
    // This is the double-booking guard in proposal §06 firing: two guests
    // raced for the same table and this one lost. Not a bug — the constraint
    // doing exactly its job. The guest is told plainly and offered a refresh.
    if (hasPostgresCode(error, "23P01")) {
      return reply.status(409).send({
        error: {
          code: "TABLE_ALREADY_BOOKED",
          message: "That table was just taken. Here are the times still open.",
        },
      });
    }

    // 23505 = unique_violation. Which constraint fired decides the message —
    // a duplicate table name and a replayed idempotency key are both
    // "already exists" at the database level but mean very different things
    // to the person reading the response.
    if (hasPostgresCode(error, "23505")) {
      const constraint = getPostgresConstraint(error);
      const known = constraint ? DUPLICATE_MESSAGES[constraint] : undefined;

      return reply.status(409).send({
        error: {
          code: "DUPLICATE",
          message: known ?? "That already exists.",
        },
      });
    }

    // Anything reaching here is unexpected. Log it in full, tell the caller
    // nothing — stack traces and SQL leak internals to an attacker.
    request.log.error({ err: error }, "unhandled error");

    const details = error instanceof Error ? error.message : String(error);

    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong on our side. Please try again.",
        ...(isProduction ? {} : { details }),
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} does not exist.`,
      },
    });
  });
});

function hasPostgresCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function getPostgresConstraint(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  return (error as { constraint_name?: string }).constraint_name;
}

/**
 * Human messages for the unique constraints declared across packages/db's
 * migrations. Add an entry here whenever a new UNIQUE constraint is added —
 * without one, that constraint still works, it just falls back to the
 * generic "That already exists."
 */
const DUPLICATE_MESSAGES: Record<string, string> = {
  reservations_idempotency: "This booking has already been submitted.",
  tables_unique_name_per_restaurant: "A table with that name already exists.",
  staff_accounts_unique_email: "An account with that email already exists.",
  availability_one_row_per_day: "Opening hours for that day are already set.",
  time_slots_unique_start: "A time slot starting at that time already exists.",
  blocked_dates_unique: "That date is already blocked.",
  guests_unique_phone: "A guest with that phone number already exists.",
  guests_unique_email: "A guest with that email already exists.",
};
