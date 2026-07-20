import {
  reservationRulesSchema,
  updateReservationRulesResponseSchema,
  updateReservationRulesSchema,
} from "@rms/contracts";
import { reservationRules, reservations } from "@rms/db";
import { and, count, eq, inArray } from "drizzle-orm";

import { AppError } from "../../lib/errors.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import type { App } from "../../types/app.js";

const WAITING_STATUSES = ["requested", "waitlisted"] as const;

const MINUTES_PER_UNIT: Record<"hours" | "days", number> = { hours: 60, days: 60 * 24 };

/**
 * Reservation rules — proposal §10, Module 3b, and §07's booking-mode and
 * capacity settings layered onto it. One row per restaurant.
 */
export default async function rulesRoutes(app: App) {
  app.get(
    "/rules",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Get reservation rules",
        response: { 200: reservationRulesSchema },
      },
    },
    async () => {
      const restaurantId = await requireSingleRestaurant(app);
      const [row] = await app.db
        .select()
        .from(reservationRules)
        .where(eq(reservationRules.restaurantId, restaurantId))
        .limit(1);
      if (!row) throw new Error("reservation_rules row missing for this restaurant — was it seeded?");
      return row;
    },
  );

  app.patch(
    "/rules",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Update reservation rules",
        body: updateReservationRulesSchema,
        response: { 200: updateReservationRulesResponseSchema },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const [existing] = await app.db
        .select()
        .from(reservationRules)
        .where(eq(reservationRules.restaurantId, restaurantId))
        .limit(1);
      if (!existing) throw new Error("reservation_rules row missing for this restaurant — was it seeded?");

      const merged = { ...existing, ...request.body };

      // "min greater than max" — rejected, compared in real minutes so a
      // 2-hour minimum against a 1-day maximum is judged correctly rather
      // than comparing the raw numbers 2 vs 1.
      const minMinutes = merged.minAdvanceBooking * MINUTES_PER_UNIT[merged.minAdvanceUnit];
      const maxMinutes = merged.maxAdvanceBooking * MINUTES_PER_UNIT[merged.maxAdvanceUnit];
      if (minMinutes > maxMinutes) {
        throw new AppError(
          "INVALID_RULES",
          "Minimum advance booking cannot be greater than the maximum.",
          422,
        );
      }

      const [updated] = await app.db
        .update(reservationRules)
        .set(request.body)
        .where(eq(reservationRules.restaurantId, restaurantId))
        .returning();
      if (!updated) throw new Error("update returned no row");

      // E-11, adapted — see the contract's doc comment for why this is a
      // warning rather than a bulk status change.
      let pendingRequestsWarning = 0;
      if (request.body.bookingMode === "automatic" && existing.bookingMode !== "automatic") {
        const [row] = await app.db
          .select({ value: count() })
          .from(reservations)
          .where(
            and(
              eq(reservations.restaurantId, restaurantId),
              inArray(reservations.status, [...WAITING_STATUSES]),
            ),
          );
        pendingRequestsWarning = row?.value ?? 0;
      }

      return { rules: updated, pendingRequestsWarning };
    },
  );
}
