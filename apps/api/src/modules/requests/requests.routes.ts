import { acceptRequestSchema, requestQueueItemSchema } from "@rms/contracts";
import { reservationEvents, reservationRules, reservations, restaurant, tables } from "@rms/db";
import { fromInstant, isRequestUrgent, minutesBetween, nowIn } from "@rms/rules";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { AppError, NotFoundError } from "../../lib/errors.js";
import { findReservationOr404, withTableName } from "../../lib/reservation-helpers.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import { normalizeTime, timeRangesOverlap, addMinutes } from "../../lib/time.js";
import type { App } from "../../types/app.js";

const WAITING_STATUSES = ["requested", "waitlisted"] as const;
const OCCUPYING_STATUSES = ["confirmed", "overflow", "seated"] as const;

/**
 * Request queue — proposal §07 and §10's admin/staff request-queue screens.
 *
 * This is where a booking that could not confirm itself gets a human
 * decision: assign a table, accept it as overflow without one yet, or
 * decline. Both the admin dashboard and the staff tablet read this same
 * queue and act on it — the proposal is explicit that whoever is looking at
 * the floor is often better placed to decide than whoever is at a desk.
 */
export default async function requestsRoutes(app: App) {
  app.get(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["requests"],
        summary: "The request queue — oldest first",
        response: { 200: z.array(requestQueueItemSchema) },
      },
    },
    async () => {
      const restaurantId = await requireSingleRestaurant(app);

      const [rulesRow] = await app.db
        .select()
        .from(reservationRules)
        .where(eq(reservationRules.restaurantId, restaurantId))
        .limit(1);
      const [restaurantRow] = await app.db.select().from(restaurant).where(eq(restaurant.id, restaurantId)).limit(1);
      if (!rulesRow || !restaurantRow) throw new Error("restaurant configuration missing");

      const waiting = await app.db
        .select()
        .from(reservations)
        .where(and(eq(reservations.restaurantId, restaurantId), inArray(reservations.status, [...WAITING_STATUSES])))
        .orderBy(reservations.requestedAt);

      const now = nowIn(restaurantRow.timezone);

      const items = await Promise.all(
        waiting.map(async (reservation) => {
          const capacity = await getCapacityMeter(
            app,
            restaurantId,
            reservation.reservationDate,
            reservation.reservationTime,
            reservation.partySize,
            rulesRow,
          );

          const requestedAt = fromInstant(reservation.requestedAt, restaurantRow.timezone);
          const waitingMinutes = Math.max(0, minutesBetween(requestedAt, now));
          const isUrgent = reservation.expiresAt
            ? isRequestUrgent(fromInstant(reservation.expiresAt, restaurantRow.timezone), rulesRow, now)
            : false;

          return {
            reservation: await withTableName(app, reservation),
            reason: (reservation.tableId ? "manual_mode" : "no_table") as "manual_mode" | "no_table",
            waitingMinutes,
            isUrgent,
            capacity,
          };
        }),
      );

      return items;
    },
  );

  app.post(
    "/:id/accept",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["requests"],
        summary: "Accept a request, assigning a table (or confirming the one already held)",
        params: z.object({ id: z.string().uuid() }),
        body: acceptRequestSchema,
        response: { 200: requestQueueItemSchema.shape.reservation },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const reservation = await requireWaiting(app, request.params.id, restaurantId);

      const tableId = request.body.tableId ?? reservation.tableId;
      if (!tableId) {
        throw new AppError(
          "TABLE_REQUIRED",
          "This request has no table held — provide a tableId, or use accept-overflow instead.",
          400,
        );
      }

      const [table] = await app.db
        .select()
        .from(tables)
        .where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurantId), eq(tables.status, "active")))
        .limit(1);
      if (!table) throw new NotFoundError("Table");
      if (table.seats < reservation.partySize) {
        throw new AppError("TABLE_TOO_SMALL", `Table ${table.tableName} seats ${table.seats}, this party is ${reservation.partySize}.`, 422);
      }

      const actor = request.user?.name ?? "staff";

      try {
        const updated = await app.db.transaction(async (tx) => {
          // The exclusion constraint is the actual arbiter here too: if this
          // table was taken by someone else for this exact slot in the
          // interval since the queue was loaded, this UPDATE itself is
          // rejected with 23P01 — proposal §07's "the assignment is
          // rejected and free alternatives are offered" is this, not a
          // separate pre-check.
          const [row] = await tx
            .update(reservations)
            .set({ tableId: table.id, status: "confirmed", decidedAt: new Date(), decidedBy: actor })
            .where(eq(reservations.id, reservation.id))
            .returning();
          if (!row) throw new Error("update returned no row");

          await tx.insert(reservationEvents).values({
            reservationId: row.id,
            fromStatus: reservation.status,
            toStatus: row.status,
            actor,
          });

          return row;
        });

        return withTableName(app, updated);
      } catch (error) {
        throw error; // let the global handler translate 23P01 -> 409
      }
    },
  );

  app.post(
    "/:id/accept-overflow",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["requests"],
        summary: "Accept a request beyond the table grid — table decided later",
        params: z.object({ id: z.string().uuid() }),
        response: { 200: requestQueueItemSchema.shape.reservation },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const reservation = await requireWaiting(app, request.params.id, restaurantId);
      const actor = request.user?.name ?? "staff";

      const updated = await app.db.transaction(async (tx) => {
        const [row] = await tx
          .update(reservations)
          .set({ status: "overflow", isOverflow: true, decidedAt: new Date(), decidedBy: actor })
          .where(eq(reservations.id, reservation.id))
          .returning();
        if (!row) throw new Error("update returned no row");

        await tx.insert(reservationEvents).values({
          reservationId: row.id,
          fromStatus: reservation.status,
          toStatus: row.status,
          actor,
        });

        return row;
      });

      return withTableName(app, updated);
    },
  );

  app.post(
    "/:id/decline",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["requests"],
        summary: "Decline a request",
        params: z.object({ id: z.string().uuid() }),
        response: { 200: requestQueueItemSchema.shape.reservation },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const reservation = await requireWaiting(app, request.params.id, restaurantId);
      const actor = request.user?.name ?? "staff";

      const updated = await app.db.transaction(async (tx) => {
        const [row] = await tx
          .update(reservations)
          .set({ status: "declined", decidedAt: new Date(), decidedBy: actor })
          .where(eq(reservations.id, reservation.id))
          .returning();
        if (!row) throw new Error("update returned no row");

        await tx.insert(reservationEvents).values({
          reservationId: row.id,
          fromStatus: reservation.status,
          toStatus: row.status,
          actor,
        });

        return row;
      });

      return withTableName(app, updated);
    },
  );
}

async function requireWaiting(app: App, id: string, restaurantId: string) {
  const reservation = await findReservationOr404(app, id, restaurantId);
  if (!(WAITING_STATUSES as readonly string[]).includes(reservation.status)) {
    throw new AppError(
      "NOT_WAITING",
      `This reservation is "${reservation.status}", not waiting on a decision.`,
      409,
    );
  }
  return reservation;
}

async function getCapacityMeter(
  app: App,
  restaurantId: string,
  date: string,
  time: string,
  partySize: number,
  rules: { overflowPartiesPerSlot: number; overflowCoversPerSlot: number },
) {
  const dayReservations = await app.db
    .select({
      tableId: reservations.tableId,
      reservationTime: reservations.reservationTime,
      durationMinutes: reservations.durationMinutes,
      partySize: reservations.partySize,
      status: reservations.status,
    })
    .from(reservations)
    .where(and(eq(reservations.restaurantId, restaurantId), eq(reservations.reservationDate, date)));

  const activeTables = await app.db
    .select({ id: tables.id, seats: tables.seats })
    .from(tables)
    .where(and(eq(tables.restaurantId, restaurantId), eq(tables.status, "active")));

  const fitting = activeTables.filter((t) => t.seats >= partySize);
  const slotEnd = addMinutes(time, 90);

  const occupied = fitting.filter((t) =>
    dayReservations.some(
      (r) =>
        r.tableId === t.id &&
        (OCCUPYING_STATUSES as readonly string[]).includes(r.status) &&
        timeRangesOverlap(time, slotEnd, r.reservationTime, addMinutes(r.reservationTime, r.durationMinutes)),
    ),
  ).length;

  const overflowAtSlot = dayReservations.filter(
    (r) => r.status === "overflow" && normalizeTime(r.reservationTime) === normalizeTime(time),
  );
  const waitingAtSlot = dayReservations.filter(
    (r) =>
      (WAITING_STATUSES as readonly string[]).includes(r.status) &&
      normalizeTime(r.reservationTime) === normalizeTime(time),
  );

  return {
    tablesOccupied: occupied,
    tablesTotal: fitting.length,
    overflowPartiesAccepted: overflowAtSlot.length,
    overflowPartiesAllowed: rules.overflowPartiesPerSlot,
    overflowCoversAccepted: overflowAtSlot.reduce((sum, r) => sum + r.partySize, 0),
    overflowCoversAllowed: rules.overflowCoversPerSlot,
    requestsWaitingSameSlot: waitingAtSlot.length,
  };
}
