import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

import { AppError } from "../lib/errors.js";
import { isProduction } from "../config/env.js";

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
export default fp(async function errorHandlerPlugin(app: FastifyInstance) {
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

    // 23505 = unique_violation, most often a replayed idempotency key.
    if (hasPostgresCode(error, "23505")) {
      return reply.status(409).send({
        error: {
          code: "DUPLICATE",
          message: "This booking has already been submitted.",
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
