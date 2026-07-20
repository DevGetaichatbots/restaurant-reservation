import { loginRequestSchema, loginResponseSchema } from "@rms/contracts";
import { staffAccounts } from "@rms/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { AppError } from "../../lib/errors.js";
import { signAuthToken, verifyPassword } from "../../lib/auth.js";
import type { App } from "../../types/app.js";

/**
 * Admin and staff sign-in.
 *
 * Interim JWT auth — see config/env.ts and lib/auth.ts for why. Nothing about
 * the shape of these routes changes when that swap happens; only what's
 * behind `verifyPassword`/`signAuthToken` does.
 */
export default async function authRoutes(app: App) {
  app.post(
    "/login",
    {
      config: {
        // Deliberately tighter than the global default (proposal §12,
        // preventing credential-stuffing against a login form).
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
      schema: {
        tags: ["auth"],
        summary: "Sign in as admin or staff",
        body: loginRequestSchema,
        response: { 200: loginResponseSchema },
      },
    },
    async (request) => {
      const { email, password } = request.body;

      const [account] = await app.db
        .select()
        .from(staffAccounts)
        .where(and(eq(staffAccounts.email, email), eq(staffAccounts.isActive, true)))
        .limit(1);

      // Same error for "no such account" and "wrong password" — distinguishing
      // them tells an attacker which emails exist in the system.
      if (!account) {
        throw new AppError("INVALID_CREDENTIALS", "Incorrect email or password.", 401);
      }

      const valid = await verifyPassword(password, account.passwordHash);
      if (!valid) {
        throw new AppError("INVALID_CREDENTIALS", "Incorrect email or password.", 401);
      }

      const token = await signAuthToken({
        sub: account.id,
        restaurantId: account.restaurantId,
        role: account.role,
        name: account.name,
      });

      await app.db
        .update(staffAccounts)
        .set({ lastLoginAt: new Date() })
        .where(eq(staffAccounts.id, account.id));

      return {
        token,
        user: { id: account.id, name: account.name, email: account.email, role: account.role },
      };
    },
  );

  app.get(
    "/me",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["auth"],
        summary: "The currently signed-in user",
        response: {
          200: z.object({
            id: z.string(),
            name: z.string(),
            role: z.enum(["admin", "staff"]),
            restaurantId: z.string(),
          }),
        },
      },
    },
    async (request) => {
      // request.user is guaranteed by the authenticate preHandler above.
      const user = request.user!;
      return { id: user.sub, name: user.name, role: user.role, restaurantId: user.restaurantId };
    },
  );
}
