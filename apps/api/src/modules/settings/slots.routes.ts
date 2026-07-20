import {
  createTimeSlotSchema,
  timeSlotSchema,
  updateTimeSlotSchema,
  uuidSchema,
} from "@rms/contracts";
import { reservations, timeSlots } from "@rms/db";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";

import { AppError, NotFoundError } from "../../lib/errors.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import { normalizeTime } from "../../lib/time.js";
import type { App } from "../../types/app.js";

const LIVE_STATUSES = ["requested", "waitlisted", "confirmed", "overflow", "seated"] as const;

/**
 * Time slots — proposal §10, Module 2.
 *
 * Slots are same-day increments (e.g. 30-minute chips from 11:00 to 22:00).
 * Overnight service is expressed through opening hours crossing midnight
 * (E-22), not through an individual slot spanning two calendar days.
 */
export default async function slotsRoutes(app: App) {
  app.get(
    "/slots",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "List time slots",
        response: { 200: z.array(timeSlotSchema) },
      },
    },
    async () => {
      const restaurantId = await requireSingleRestaurant(app);
      return app.db
        .select()
        .from(timeSlots)
        .where(eq(timeSlots.restaurantId, restaurantId))
        .orderBy(timeSlots.startTime);
    },
  );

  app.post(
    "/slots",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Add a time slot",
        body: createTimeSlotSchema,
        response: { 201: timeSlotSchema },
      },
    },
    async (request, reply) => {
      const restaurantId = await requireSingleRestaurant(app);

      await rejectOverlap(app, restaurantId, request.body.startTime, request.body.endTime);

      const [created] = await app.db
        .insert(timeSlots)
        .values({ ...request.body, restaurantId })
        .returning();
      if (!created) throw new Error("insert returned no row");

      reply.status(201);
      return created;
    },
  );

  app.patch(
    "/slots/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Edit a time slot",
        params: z.object({ id: uuidSchema }),
        body: updateTimeSlotSchema,
        response: { 200: timeSlotSchema },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const existing = await findSlotOr404(app, request.params.id, restaurantId);

      if (request.body.startTime || request.body.endTime) {
        await rejectOverlap(
          app,
          restaurantId,
          request.body.startTime ?? existing.startTime,
          request.body.endTime ?? existing.endTime,
          existing.id,
        );
      }

      const [updated] = await app.db
        .update(timeSlots)
        .set(request.body)
        .where(eq(timeSlots.id, existing.id))
        .returning();
      if (!updated) throw new Error("update returned no row");

      return updated;
    },
  );

  app.delete(
    "/slots/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Remove a time slot",
        params: z.object({ id: uuidSchema }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const restaurantId = await requireSingleRestaurant(app);
      const existing = await findSlotOr404(app, request.params.id, restaurantId);

      // E-10: a slot cannot be removed while live bookings sit at that start
      // time — deactivating (isActive: false) stops new bookings without
      // this check, exactly like a table's active/inactive toggle.
      const [row] = await app.db
        .select({ value: count() })
        .from(reservations)
        .where(
          and(
            eq(reservations.restaurantId, restaurantId),
            eq(reservations.reservationTime, existing.startTime),
            inArray(reservations.status, [...LIVE_STATUSES]),
          ),
        );
      const liveCount = row?.value ?? 0;

      if (liveCount > 0) {
        throw new AppError(
          "SLOT_HAS_ACTIVE_BOOKINGS",
          `${liveCount} upcoming booking(s) use this time. Reassign or cancel them, or deactivate the slot instead of deleting it.`,
          409,
          { count: liveCount },
        );
      }

      await app.db.delete(timeSlots).where(eq(timeSlots.id, existing.id));
      reply.status(204);
    },
  );
}

async function findSlotOr404(app: App, id: string, restaurantId: string) {
  const [slot] = await app.db
    .select()
    .from(timeSlots)
    .where(and(eq(timeSlots.id, id), eq(timeSlots.restaurantId, restaurantId)))
    .limit(1);
  if (!slot) throw new NotFoundError("Time slot");
  return slot;
}

/** E-21: an overlapping slot is rejected with the conflicting slot named,
 *  rather than silently creating an ambiguous double booking window. */
async function rejectOverlap(
  app: App,
  restaurantId: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
) {
  const candidates = await app.db
    .select()
    .from(timeSlots)
    .where(
      and(
        eq(timeSlots.restaurantId, restaurantId),
        excludeId ? ne(timeSlots.id, excludeId) : undefined,
      ),
    );

  const newStart = normalizeTime(startTime);
  const newEnd = normalizeTime(endTime);

  const conflict = candidates.find(
    (slot) => newStart < normalizeTime(slot.endTime) && newEnd > normalizeTime(slot.startTime),
  );

  if (conflict) {
    throw new AppError(
      "SLOT_OVERLAP",
      `This overlaps the existing slot ${conflict.startTime}–${conflict.endTime}.`,
      409,
      { conflictingSlotId: conflict.id },
    );
  }
}
