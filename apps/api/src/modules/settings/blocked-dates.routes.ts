import {
  blockedDateSchema,
  createBlockedDateSchema,
  createBlockedRangeSchema,
  uuidSchema,
} from "@rms/contracts";
import { blockedDates, reservations } from "@rms/db";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";

import { NotFoundError } from "../../lib/errors.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import type { App } from "../../types/app.js";

const LIVE_STATUSES = ["requested", "waitlisted", "confirmed", "overflow", "seated"] as const;

/**
 * Blocked dates — proposal §10, Module 3a.
 *
 * Blocking a date never cancels what's already booked on it — that decision
 * belongs to the admin, made with the affected count in front of them, never
 * taken automatically on their behalf.
 */
export default async function blockedDatesRoutes(app: App) {
  app.get(
    "/blocked-dates",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "List blocked dates",
        response: { 200: z.array(blockedDateSchema) },
      },
    },
    async () => {
      const restaurantId = await requireSingleRestaurant(app);
      return app.db
        .select()
        .from(blockedDates)
        .where(eq(blockedDates.restaurantId, restaurantId))
        .orderBy(blockedDates.blockedDate);
    },
  );

  app.post(
    "/blocked-dates",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Block a single date",
        body: createBlockedDateSchema,
        response: { 201: blockedDateSchema.extend({ affectedReservations: z.number() }) },
      },
    },
    async (request, reply) => {
      const restaurantId = await requireSingleRestaurant(app);

      const [created] = await app.db
        .insert(blockedDates)
        .values({ ...request.body, restaurantId, reason: request.body.reason ?? null })
        .returning();
      if (!created) throw new Error("insert returned no row");

      const affectedReservations = await countLiveReservationsOnDate(
        app,
        restaurantId,
        request.body.blockedDate,
      );

      reply.status(201);
      return { ...created, affectedReservations };
    },
  );

  app.post(
    "/blocked-dates/range",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Block a range of dates (e.g. a holiday closure)",
        body: createBlockedRangeSchema,
        response: {
          201: z.object({
            created: z.array(blockedDateSchema),
            affectedReservations: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const restaurantId = await requireSingleRestaurant(app);
      const { startDate, endDate, reason } = request.body;

      const dates: string[] = [];
      for (let d = new Date(`${startDate}T00:00:00Z`); d <= new Date(`${endDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10));
      }

      const created = await app.db
        .insert(blockedDates)
        .values(dates.map((blockedDate) => ({ restaurantId, blockedDate, reason: reason ?? null })))
        .onConflictDoNothing()
        .returning();

      const [row] = await app.db
        .select({ value: count() })
        .from(reservations)
        .where(
          and(
            eq(reservations.restaurantId, restaurantId),
            gte(reservations.reservationDate, startDate),
            lte(reservations.reservationDate, endDate),
            inArray(reservations.status, [...LIVE_STATUSES]),
          ),
        );

      reply.status(201);
      return { created, affectedReservations: row?.value ?? 0 };
    },
  );

  app.delete(
    "/blocked-dates/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Unblock a date",
        params: z.object({ id: uuidSchema }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const restaurantId = await requireSingleRestaurant(app);

      const [existing] = await app.db
        .select()
        .from(blockedDates)
        .where(and(eq(blockedDates.id, request.params.id), eq(blockedDates.restaurantId, restaurantId)))
        .limit(1);
      if (!existing) throw new NotFoundError("Blocked date");

      await app.db.delete(blockedDates).where(eq(blockedDates.id, existing.id));
      reply.status(204);
    },
  );
}

async function countLiveReservationsOnDate(app: App, restaurantId: string, date: string) {
  const [row] = await app.db
    .select({ value: count() })
    .from(reservations)
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        eq(reservations.reservationDate, date),
        inArray(reservations.status, [...LIVE_STATUSES]),
      ),
    );
  return row?.value ?? 0;
}
