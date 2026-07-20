import { dayHoursResponseSchema, setHoursRequestSchema } from "@rms/contracts";
import { availabilitySettings, reservations } from "@rms/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import { normalizeTime } from "../../lib/time.js";
import type { App } from "../../types/app.js";

const LIVE_STATUSES = ["requested", "waitlisted", "confirmed", "overflow", "seated"] as const;

/**
 * Opening hours — proposal §10, Module 2.
 *
 * Always exactly seven rows, one per day of week, so this is a bulk-replace
 * endpoint rather than per-row CRUD: the admin's Opening Hours tab edits all
 * seven at once and saves them together.
 */
export default async function hoursRoutes(app: App) {
  app.get(
    "/hours",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Get opening hours (all 7 days)",
        response: { 200: z.array(dayHoursResponseSchema) },
      },
    },
    async () => {
      const restaurantId = await requireSingleRestaurant(app);
      return app.db
        .select()
        .from(availabilitySettings)
        .where(eq(availabilitySettings.restaurantId, restaurantId))
        .orderBy(availabilitySettings.dayOfWeek);
    },
  );

  app.put(
    "/hours",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Replace opening hours",
        body: setHoursRequestSchema,
        response: {
          200: z.object({
            days: z.array(dayHoursResponseSchema),
            // E-09: hours narrowed or a day closed over bookings that already
            // exist there. Informational only — nothing here is ever
            // cancelled automatically; the admin decides what to do next.
            affectedReservations: z.array(
              z.object({
                id: z.string(),
                guestName: z.string(),
                dayOfWeek: z.number(),
                reservationDate: z.string(),
                reservationTime: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const current = await app.db
        .select()
        .from(availabilitySettings)
        .where(eq(availabilitySettings.restaurantId, restaurantId));

      const affectedReservations = await findReservationsOutsideNewHours(
        app,
        restaurantId,
        current,
        request.body.days,
      );

      const days = await app.db.transaction(async (tx) => {
        const rows = [];
        for (const day of request.body.days) {
          const [row] = await tx
            .insert(availabilitySettings)
            .values({ ...day, restaurantId })
            .onConflictDoUpdate({
              target: [availabilitySettings.restaurantId, availabilitySettings.dayOfWeek],
              set: { openTime: day.openTime, closeTime: day.closeTime, isOpen: day.isOpen },
            })
            .returning();
          if (row) rows.push(row);
        }
        return rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      });

      return { days, affectedReservations };
    },
  );
}

async function findReservationsOutsideNewHours(
  app: App,
  restaurantId: string,
  current: (typeof availabilitySettings.$inferSelect)[],
  proposed: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }[],
) {
  const narrowedDays = proposed.filter((next) => {
    const before = current.find((c) => c.dayOfWeek === next.dayOfWeek);
    if (!before) return false;
    // Newly closed, or the window shrank on either edge. Both sides
    // normalized — `before` comes from the database ("HH:MM:SS"), `next`
    // from the request body, which may arrive as "HH:MM". See lib/time.ts.
    return (
      (before.isOpen && !next.isOpen) ||
      (next.isOpen &&
        (normalizeTime(next.openTime) > normalizeTime(before.openTime) ||
          normalizeTime(next.closeTime) < normalizeTime(before.closeTime)))
    );
  });

  if (narrowedDays.length === 0) return [];

  const liveReservations = await app.db
    .select({
      id: reservations.id,
      guestName: reservations.guestName,
      reservationDate: reservations.reservationDate,
      reservationTime: reservations.reservationTime,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        inArray(reservations.status, [...LIVE_STATUSES]),
        gte(reservations.reservationDate, sql`current_date`),
      ),
    );

  const affected: {
    id: string;
    guestName: string;
    dayOfWeek: number;
    reservationDate: string;
    reservationTime: string;
  }[] = [];

  for (const reservation of liveReservations) {
    const dayOfWeek = new Date(`${reservation.reservationDate}T00:00:00Z`).getUTCDay();
    const day = narrowedDays.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) continue;

    const reservationTime = normalizeTime(reservation.reservationTime);
    const outsideNewHours =
      !day.isOpen ||
      reservationTime < normalizeTime(day.openTime) ||
      reservationTime >= normalizeTime(day.closeTime);

    if (outsideNewHours) {
      affected.push({ ...reservation, dayOfWeek });
    }
  }

  return affected;
}
