import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

/**
 * The Fastify instance type, carrying the Zod type provider.
 *
 * `app.ts` calls `.withTypeProvider<ZodTypeProvider>()` once at boot, which
 * gives `request.body`/`request.query` their inferred types wherever that
 * exact instance is used directly. Autoload, however, passes `app` into each
 * module's default-export function as a plain parameter — and a bare
 * `FastifyInstance` annotation there silently widens back to the untyped
 * default, so every route module and plugin imports this alias instead.
 */
export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;
