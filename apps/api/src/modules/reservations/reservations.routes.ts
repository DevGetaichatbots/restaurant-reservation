import {
  createReservationResponseSchema,
  createReservationSchema,
  listReservationsQuerySchema,
  performReservationActionSchema,
  reservationSchema,
  uuidSchema,
} from "@rms/contracts";
import {
  guests,
  reservationEvents,
  reservationRules,
  reservations,
  restaurant,
  tables,
  timeSlots,
} from "@rms/db";
import {
  checkAdvanceWindow,
  checkContactInformation,
  checkPartySize,
  checkSameDayAllowed,
  checkCancellationAllowed,
  computeRequestExpiry,
  decideBookingOutcome,
  type ReservationRulesConfig,
} from "@rms/rules";
import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { z } from "zod";

import { AppError, NotFoundError, RuleViolationError } from "../../lib/errors.js";
import { findReservationOr404, serializeReservation, withTableName } from "../../lib/reservation-helpers.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import { normalizeTime } from "../../lib/time.js";
import type { App } from "../../types/app.js";

const TERMINAL_STATUSES = ["cancelled", "completed", "declined", "expired", "no_show"] as const;

/**
 * Reservations — proposal §09 Step 5/6 (creation), §10 Module 4 (the admin
 * list), and the forward-progression actions from §11 (staff tablet).
 *
 * Table assignment for something still sitting as `requested`/`waitlisted`
 * is deliberately NOT here — that is the Requests module's job (§07's
 * accept/assign/decline flow). This module creates bookings and moves an
 * already-tabled one forward: seat, complete, no-show, cancel.
 */
export default async function reservationsRoutes(app: App) {
  app.post(
    "/",
    {
      config: {
        // Stricter than the global default — this is the endpoint a bot
        // filling every table would hit (§12, E-17/E-35).
        rateLimit: { max: 20, timeWindow: "1 minute" },
      },
      schema: {
        tags: ["reservations"],
        summary: "Create a reservation",
        headers: z.object({ "idempotency-key": z.string().optional() }),
        body: createReservationSchema,
        response: { 201: createReservationResponseSchema, 200: createReservationResponseSchema },
      },
    },
    async (request, reply) => {
      const restaurantId = await requireSingleRestaurant(app);
      const idempotencyKey = request.headers["idempotency-key"];

      // A repeated key returns the original booking rather than creating a
      // second one — covers a double-tapped Confirm button and a client
      // retrying after a dropped connection (§12, E-04).
      if (idempotencyKey) {
        const [existing] = await app.db
          .select()
          .from(reservations)
          .where(
            and(eq(reservations.restaurantId, restaurantId), eq(reservations.idempotencyKey, idempotencyKey)),
          )
          .limit(1);

        if (existing) {
          reply.status(200);
          return {
            reservation: await toGuestView(app, existing),
            message: messageFor(existing.status),
          };
        }
      }

      const [restaurantRow] = await app.db.select().from(restaurant).where(eq(restaurant.id, restaurantId)).limit(1);
      if (!restaurantRow) throw new Error("restaurant row missing");

      const [rulesRow] = await app.db
        .select()
        .from(reservationRules)
        .where(eq(reservationRules.restaurantId, restaurantId))
        .limit(1);
      if (!rulesRow) throw new Error("reservation_rules row missing — was it seeded?");
      const rules: ReservationRulesConfig = rulesRow;

      const body = request.body;
      const target = { date: body.reservationDate, time: body.reservationTime };

      // ── Rule checks — the authoritative pass. Whatever the guest UI
      // already validated is re-checked here from scratch. ──────────────────
      assertRule(checkAdvanceWindow(target, rules, restaurantRow.timezone));
      assertRule(checkSameDayAllowed(target, rules, restaurantRow.timezone));
      assertRule(checkContactInformation({ phone: body.guestPhone, email: body.guestEmail }, rules));

      let table: typeof tables.$inferSelect | undefined;
      if (body.tableId) {
        const [row] = await app.db
          .select()
          .from(tables)
          .where(and(eq(tables.id, body.tableId), eq(tables.restaurantId, restaurantId), eq(tables.status, "active")))
          .limit(1);
        if (!row) throw new NotFoundError("Table");
        table = row;
      }

      assertRule(checkPartySize(body.partySize, rules, table?.seats));

      const durationMinutes = await getDurationForTime(app, restaurantId, body.reservationTime);

      let status: (typeof reservations.$inferSelect)["status"];
      let isOverflow = false;
      let expiresAt: Date | null = null;

      if (table) {
        // A specific, previously-free table was chosen. Whether it is
        // confirmed outright or held pending manual approval, the table is
        // reserved either way — the exclusion constraint on the insert below
        // is what actually adjudicates a race with another guest, not this
        // decision.
        const outcome = decideBookingOutcome({
          mode: rules.bookingMode,
          tableAvailable: true,
          partySize: body.partySize,
          overflowPartiesPerSlot: rules.overflowPartiesPerSlot,
          overflowCoversPerSlot: rules.overflowCoversPerSlot,
          allowWaitlist: rules.allowWaitlist,
          overflowPartiesAccepted: 0,
          overflowCoversAccepted: 0,
        });
        status = outcome.status === "confirmed" ? "confirmed" : "requested";
      } else {
        const overflow = await getOverflowCounts(app, restaurantId, body.reservationDate, body.reservationTime);
        const outcome = decideBookingOutcome({
          mode: rules.bookingMode,
          tableAvailable: false,
          partySize: body.partySize,
          overflowPartiesPerSlot: rules.overflowPartiesPerSlot,
          overflowCoversPerSlot: rules.overflowCoversPerSlot,
          allowWaitlist: rules.allowWaitlist,
          overflowPartiesAccepted: overflow.parties,
          overflowCoversAccepted: overflow.covers,
        });

        if (outcome.status === "unavailable") {
          throw new AppError(
            "SLOT_UNAVAILABLE",
            "This time is no longer available. Please choose another.",
            409,
          );
        }

        status = outcome.status;
        isOverflow = false; // set true only once accepted as overflow, via the Requests module
        expiresAt = new Date(
          computeRequestExpiry(target, restaurantRow.timezone, rules).epochMilliseconds,
        );
      }

      const guestId = await upsertGuest(app, restaurantId, {
        name: body.guestName,
        phone: body.guestPhone ?? null,
        email: body.guestEmail ?? null,
        marketingOptIn: body.marketingOptIn,
      });

      let created: typeof reservations.$inferSelect;
      try {
        created = await app.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(reservations)
            .values({
              restaurantId,
              tableId: table?.id ?? null,
              guestId,
              guestName: body.guestName,
              guestPhone: body.guestPhone ?? null,
              guestEmail: body.guestEmail ?? null,
              partySize: body.partySize,
              reservationDate: body.reservationDate,
              reservationTime: body.reservationTime,
              durationMinutes,
              status,
              isOverflow,
              marketingOptIn: body.marketingOptIn,
              source: body.source,
              notes: body.notes,
              idempotencyKey: idempotencyKey ?? null,
              expiresAt,
            })
            .returning();
          if (!row) throw new Error("insert returned no row");

          await tx.insert(reservationEvents).values({
            reservationId: row.id,
            fromStatus: null,
            toStatus: row.status,
            actor: "guest",
          });

          return row;
        });
      } catch (error) {
        // Table-taken races surface here as a Postgres exclusion violation;
        // the global error handler turns 23P01 into a 409 with the guest
        // message already written (proposal §06). Re-throwing lets it do so.
        throw error;
      }

      reply.status(201);
      return { reservation: await toGuestView(app, created), message: messageFor(created.status) };
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["reservations"],
        summary: "Get a reservation (guest confirmation / manage-booking view)",
        params: z.object({ id: uuidSchema }),
        response: { 200: reservationSchema.omit({ notes: true }) },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const reservation = await findReservationOr404(app, request.params.id, restaurantId);
      return toGuestView(app, reservation);
    },
  );

  app.patch(
    "/:id/cancel",
    {
      schema: {
        tags: ["reservations"],
        summary: "Cancel a reservation (guest self-service or staff override)",
        params: z.object({ id: uuidSchema }),
        response: { 200: reservationSchema.omit({ notes: true }) },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const reservation = await findReservationOr404(app, request.params.id, restaurantId);

      if ((TERMINAL_STATUSES as readonly string[]).includes(reservation.status)) {
        throw new AppError("ALREADY_RESOLVED", "This booking is already resolved and cannot be cancelled.", 409);
      }

      // A still-pending request has no cancellation window to respect —
      // withdrawing it is unconditional. Only a booking the restaurant has
      // actually committed to (confirmed/overflow/seated) is subject to the
      // cancellation-time-limit rule.
      if (["confirmed", "overflow", "seated"].includes(reservation.status)) {
        const [rulesRow] = await app.db
          .select()
          .from(reservationRules)
          .where(eq(reservationRules.restaurantId, restaurantId))
          .limit(1);
        const [restaurantRow] = await app.db.select().from(restaurant).where(eq(restaurant.id, restaurantId)).limit(1);
        if (!rulesRow || !restaurantRow) throw new Error("restaurant configuration missing");

        assertRule(
          checkCancellationAllowed(
            { date: reservation.reservationDate, time: reservation.reservationTime },
            rulesRow,
            restaurantRow.timezone,
          ),
        );
      }

      const updated = await transitionStatus(app, reservation, "cancelled", "guest");
      return toGuestView(app, updated);
    },
  );

  app.get(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["reservations"],
        summary: "List reservations (admin/staff)",
        querystring: listReservationsQuerySchema,
        response: { 200: z.array(reservationSchema) },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const { date, from, to, status, search } = request.query;

      const rows = await app.db
        .select({ reservation: reservations, tableName: tables.tableName })
        .from(reservations)
        .leftJoin(tables, eq(reservations.tableId, tables.id))
        .where(
          and(
            eq(reservations.restaurantId, restaurantId),
            date ? eq(reservations.reservationDate, date) : undefined,
            from ? gte(reservations.reservationDate, from) : undefined,
            to ? lte(reservations.reservationDate, to) : undefined,
            status ? eq(reservations.status, status) : undefined,
            search
              ? or(ilike(reservations.guestName, `%${search}%`), ilike(reservations.guestPhone, `%${search}%`))
              : undefined,
          ),
        )
        .orderBy(reservations.reservationDate, reservations.reservationTime)
        .limit(200);

      return rows.map(({ reservation, tableName }) => serializeReservation(reservation, tableName));
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["reservations"],
        summary: "Advance a reservation: seat, complete, no-show, or cancel",
        params: z.object({ id: uuidSchema }),
        body: performReservationActionSchema,
        response: { 200: reservationSchema },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const reservation = await findReservationOr404(app, request.params.id, restaurantId);

      const nextStatus = validateAction(reservation, request.body.action);
      const actor = request.user?.name ?? "staff";
      const updated = await transitionStatus(app, reservation, nextStatus, actor);

      const [tableRow] = updated.tableId
        ? await app.db.select({ tableName: tables.tableName }).from(tables).where(eq(tables.id, updated.tableId)).limit(1)
        : [undefined];

      return serializeReservation(updated, tableRow?.tableName ?? null);
    },
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function assertRule(result: { ok: boolean; rule?: string; message?: string }) {
  if (!result.ok) throw new RuleViolationError(result.rule ?? "rule", result.message ?? "That isn't allowed.");
}

function messageFor(status: string): string {
  switch (status) {
    case "confirmed":
      return "Your reservation is confirmed!";
    case "requested":
      return "Request received — we'll confirm shortly.";
    case "waitlisted":
      return "You're on the waitlist — we'll let you know if a table opens up.";
    default:
      return "Your reservation has been recorded.";
  }
}

async function toGuestView(app: App, reservation: typeof reservations.$inferSelect) {
  const { notes: _notes, ...rest } = await withTableName(app, reservation);
  return rest;
}

async function getDurationForTime(app: App, restaurantId: string, time: string): Promise<number> {
  const [row] = await app.db
    .select({ durationMinutes: timeSlots.durationMinutes })
    .from(timeSlots)
    .where(and(eq(timeSlots.restaurantId, restaurantId), eq(timeSlots.startTime, normalizeTime(time))))
    .limit(1);
  return row?.durationMinutes ?? 90;
}

async function getOverflowCounts(app: App, restaurantId: string, date: string, time: string) {
  const rows = await app.db
    .select({ partySize: reservations.partySize })
    .from(reservations)
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        eq(reservations.reservationDate, date),
        eq(reservations.reservationTime, normalizeTime(time)),
        eq(reservations.status, "overflow"),
      ),
    );
  return { parties: rows.length, covers: rows.reduce((sum, r) => sum + r.partySize, 0) };
}

async function upsertGuest(
  app: App,
  restaurantId: string,
  guest: { name: string; phone: string | null; email: string | null; marketingOptIn: boolean },
): Promise<string | null> {
  if (!guest.phone && !guest.email) return null;

  const existing = await app.db
    .select()
    .from(guests)
    .where(
      and(
        eq(guests.restaurantId, restaurantId),
        or(
          guest.phone ? eq(guests.phone, guest.phone) : undefined,
          guest.email ? eq(guests.email, guest.email) : undefined,
        ),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await app.db
      .update(guests)
      .set({ name: guest.name, marketingOptIn: guest.marketingOptIn || existing[0].marketingOptIn })
      .where(eq(guests.id, existing[0].id));
    return existing[0].id;
  }

  const [created] = await app.db
    .insert(guests)
    .values({ restaurantId, ...guest })
    .returning();
  return created?.id ?? null;
}

/** status -> which prior statuses may reach it, via which staff action. */
const TRANSITIONS: Record<string, { from: readonly string[]; requiresTable?: boolean }> = {
  seated: { from: ["confirmed", "overflow"], requiresTable: true },
  completed: { from: ["seated"] },
  no_show: { from: ["confirmed", "overflow"] },
  cancelled: { from: ["requested", "waitlisted", "confirmed", "overflow", "seated"] },
};

const ACTION_TO_STATUS: Record<string, keyof typeof TRANSITIONS> = {
  seat: "seated",
  complete: "completed",
  no_show: "no_show",
  cancel: "cancelled",
};

function validateAction(reservation: typeof reservations.$inferSelect, action: string): string {
  const nextStatus = ACTION_TO_STATUS[action];
  if (!nextStatus) throw new AppError("INVALID_ACTION", `Unknown action "${action}".`, 400);

  const rule = TRANSITIONS[nextStatus];
  if (!rule?.from.includes(reservation.status)) {
    throw new AppError(
      "INVALID_TRANSITION",
      `Cannot ${action} a reservation that is currently "${reservation.status}".`,
      409,
    );
  }

  if (rule.requiresTable && !reservation.tableId) {
    throw new AppError(
      "NO_TABLE_ASSIGNED",
      "This reservation has no table assigned yet — accept it through the request queue first.",
      409,
    );
  }

  return nextStatus;
}

async function transitionStatus(
  app: App,
  reservation: typeof reservations.$inferSelect,
  nextStatus: string,
  actor: string,
) {
  return app.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(reservations)
      .set({ status: nextStatus as (typeof reservations.$inferSelect)["status"], decidedAt: new Date() })
      .where(eq(reservations.id, reservation.id))
      .returning();
    if (!updated) throw new Error("update returned no row");

    await tx.insert(reservationEvents).values({
      reservationId: reservation.id,
      fromStatus: reservation.status,
      toStatus: updated.status,
      actor,
    });

    return updated;
  });
}
