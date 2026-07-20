import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { AppError } from "../lib/errors.js";
import { verifyAuthToken, type AuthClaims } from "../lib/auth.js";
import type { App } from "../types/app.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthClaims;
  }

  interface FastifyInstance {
    /** Attach to a route's `preHandler` to require a valid session. Populates
     *  `request.user`. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Attach alongside `authenticate` to further require a specific role —
     *  e.g. `requireRole("admin")` on routes only the owner should reach. */
    requireRole: (role: "admin" | "staff") => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Reads the `Authorization: Bearer <token>` header, verifies it, and attaches
 * the decoded claims to the request.
 *
 * Deliberately a preHandler a route opts into, rather than a global hook —
 * the guest booking endpoints are public by design (proposal §09) and must
 * never accidentally end up behind a login.
 */
export default fp(async function authPlugin(app: App) {
  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHORIZED", "Sign in to continue.", 401);
    }

    const token = header.slice("Bearer ".length);

    try {
      request.user = await verifyAuthToken(token);
    } catch {
      throw new AppError("UNAUTHORIZED", "Your session has expired. Please sign in again.", 401);
    }
  });

  app.decorate("requireRole", (role: "admin" | "staff") => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      // Relies on `authenticate` having already run and populated request.user
      // — routes list both preHandlers in order.
      if (request.user?.role !== role) {
        throw new AppError("FORBIDDEN", "You don't have permission to do that.", 403);
      }
    };
  });
});
