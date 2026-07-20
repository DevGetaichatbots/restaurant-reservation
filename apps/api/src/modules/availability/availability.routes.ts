import {
  calendarDayQuerySchema,
  calendarDaySchema,
  slotAvailabilitySchema,
  slotsQuerySchema,
  tableAvailabilitySchema,
  tablesQuerySchema,
} from "@rms/contracts";
import {
  availabilitySettings,
  blockedDates,
  reservationRules,
  reservations,
  restaurant,
  tables,
  timeSlots,
} from "@rms/db";
import { decideBookingOutcome, type ReservationRulesConfig } from "@rms/rules";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";

import { addMinutes, normalizeTime, timeRangesOverlap } from "../../lib/time.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import type { App } from "../../types/app.js";

// Requested/waitlisted reservations always have tableId=null (proposal §07 —
// a request holds no table yet), so including them here is harmless for
// per-table overlap checks: they simply never match a table id. Including
// them IS necessary for the overflow-allowance count in summarizeOverflow.
const LIVE_STATUSES = ["requested", "waitlisted", "confirmed", "overflow", "seated"] as const;

/**
 * Availability — proposal §09, the read behind Steps 2–4 of the guest
 * booking flow. Entirely public: no login, this is what the booking page
 * calls before a guest has entered any contact details.
 *
 * Every endpoint here is a *preview*. The authoritative check runs again,
 * server-side, inside the write transaction when a booking is actually
 * submitted (Reservations module) — nothing shown here is trusted on its own,
 * matching the principle stated in proposal §02.
 */
export default async function availabilityRoutes(app: App) {
  app.get(
    "/calendar",
    {
      schema: {
        tags: ["availability"],
        summary: "Which dates in a month can be booked",
        querystring: calendarDayQuerySchema,
        response: { 200: z.array(calendarDaySchema) },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const [restaurantRow] = await app.db
        .select()
        .from(restaurant)
        .where(eq(restaurant.id, restaurantId))
        .limit(1);
      if (!restaurantRow) throw new Error("restaurant row missing");

      const rules = await getRules(app, restaurantId);
      const hours = await app.db
        .select()
        .from(availabilitySettings)
        .where(eq(availabilitySettings.restaurantId, restaurantId));

      const [year, month] = request.query.month.split("-").map(Number) as [number, number];
      const monthStart = `${request.query.month}-01`;
      const daysInMonth = new Temporal.PlainYearMonth(year, month).daysInMonth;
      const monthEnd = `${request.query.month}-${String(daysInMonth).padStart(2, "0")}`;

      const blocked = await app.db
        .select()
        .from(blockedDates)
        .where(
          and(
            eq(blockedDates.restaurantId, restaurantId),
            gte(blockedDates.blockedDate, monthStart),
            lte(blockedDates.blockedDate, monthEnd),
          ),
        );

      const now = Temporal.Now.zonedDateTimeISO(restaurantRow.timezone);
      const today = now.toPlainDate();

      const minAdvanceDays = toDaysApprox(rules.minAdvanceBooking, rules.minAdvanceUnit);
      const maxAdvanceDays = toDaysApprox(rules.maxAdvanceBooking, rules.maxAdvanceUnit);
      const earliestBookable = today.add({ days: minAdvanceDays });
      const latestBookable = today.add({ days: maxAdvanceDays });

      const days = [];
      for (let day = 1; day <= daysInMonth; day += 1) {
        const dateStr = `${request.query.month}-${String(day).padStart(2, "0")}`;
        const plainDate = Temporal.PlainDate.from(dateStr);

        // The categories below are a UI-friendly approximation at day
        // granularity — the minute-precise version of this same rule
        // (@rms/rules' checkAdvanceWindow) runs again, authoritatively, when
        // the guest actually selects a time and submits. This endpoint only
        // has to be a good preview, never the final word.
        if (Temporal.PlainDate.compare(plainDate, today) < 0) {
          days.push({ date: dateStr, bookable: false, reason: "past" as const });
          continue;
        }

        const blockedRow = blocked.find((b) => b.blockedDate === dateStr);
        if (blockedRow) {
          days.push({
            date: dateStr,
            bookable: false,
            reason: "blocked" as const,
            blockedReason: blockedRow.reason,
          });
          continue;
        }

        const pgDayOfWeek = plainDate.dayOfWeek % 7; // Temporal: 1=Mon..7=Sun → 0=Sun..6=Sat
        const dayHours = hours.find((h) => h.dayOfWeek === pgDayOfWeek);
        if (!dayHours?.isOpen) {
          days.push({ date: dateStr, bookable: false, reason: "closed" as const });
          continue;
        }

        const isToday = Temporal.PlainDate.compare(plainDate, today) === 0;
        if (isToday && !rules.allowSameDayBooking) {
          days.push({ date: dateStr, bookable: false, reason: "same_day_not_allowed" as const });
          continue;
        }

        if (!isToday && Temporal.PlainDate.compare(plainDate, earliestBookable) < 0) {
          days.push({ date: dateStr, bookable: false, reason: "too_soon" as const });
          continue;
        }

        if (Temporal.PlainDate.compare(plainDate, latestBookable) > 0) {
          days.push({ date: dateStr, bookable: false, reason: "too_far_ahead" as const });
          continue;
        }

        days.push({ date: dateStr, bookable: true });
      }

      return days;
    },
  );

  app.get(
    "/slots",
    {
      schema: {
        tags: ["availability"],
        summary: "Which time slots on a date can be booked",
        querystring: slotsQuerySchema,
        response: { 200: z.array(slotAvailabilitySchema) },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const { date, partySize } = request.query;

      if (await isDateBlocked(app, restaurantId, date)) return [];

      const dayHours = await getDayHours(app, restaurantId, date);
      if (!dayHours?.isOpen) return [];

      const rules = await getRules(app, restaurantId);
      const allSlots = await app.db
        .select()
        .from(timeSlots)
        .where(and(eq(timeSlots.restaurantId, restaurantId), eq(timeSlots.isActive, true)));

      const withinHours = allSlots.filter(
        (slot) =>
          normalizeTime(slot.startTime) >= normalizeTime(dayHours.openTime) &&
          normalizeTime(slot.endTime) <= normalizeTime(dayHours.closeTime),
      );

      const fittingTables = await getFittingTables(app, restaurantId, partySize);
      const dayReservations = await getLiveReservations(app, restaurantId, date);

      const results = withinHours
        .map((slot) => {
          const slotEnd = normalizeTime(slot.endTime);
          const anyTableFree = fittingTables.some(
            (table) => !hasOverlap(dayReservations, table.id, slot.startTime, slotEnd),
          );

          if (anyTableFree) {
            return { startTime: slot.startTime, endTime: slot.endTime, status: "available" as const };
          }

          const overflow = summarizeOverflow(dayReservations, slot.startTime);
          const outcome = decideBookingOutcome({
            mode: rules.bookingMode,
            tableAvailable: false,
            partySize,
            overflowPartiesPerSlot: rules.overflowPartiesPerSlot,
            overflowCoversPerSlot: rules.overflowCoversPerSlot,
            allowWaitlist: rules.allowWaitlist,
            overflowPartiesAccepted: overflow.parties,
            overflowCoversAccepted: overflow.covers,
          });

          const status: "unavailable" | "on_request" =
            outcome.status === "unavailable" ? "unavailable" : "on_request";
          return { startTime: slot.startTime, endTime: slot.endTime, status };
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      return results;
    },
  );

  app.get(
    "/tables",
    {
      schema: {
        tags: ["availability"],
        summary: "Table map for a specific date and time",
        querystring: tablesQuerySchema,
        response: { 200: z.array(tableAvailabilitySchema) },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const { date, time, partySize } = request.query;

      if (await isDateBlocked(app, restaurantId, date)) return [];

      const matchingSlot = await app.db
        .select()
        .from(timeSlots)
        .where(and(eq(timeSlots.restaurantId, restaurantId), eq(timeSlots.startTime, normalizeTime(time))))
        .limit(1);
      const duration = matchingSlot[0]?.durationMinutes ?? 90;
      const endTime = addMinutes(time, duration);

      const activeTables = await app.db
        .select()
        .from(tables)
        .where(and(eq(tables.restaurantId, restaurantId), eq(tables.status, "active")));
      // isNull(archivedAt) intentionally omitted from the filter here — the
      // status='active' check above already excludes archived tables in
      // practice, since archiving and deactivating happen together in this
      // schema's admin flows.

      const dayReservations = await getLiveReservations(app, restaurantId, date);

      return activeTables
        .map((table) => {
          if (table.seats < partySize) {
            return { id: table.id, tableName: table.tableName, seats: table.seats, location: table.location, status: "too_small" as const };
          }
          const occupied = hasOverlap(dayReservations, table.id, time, endTime);
          const status: "occupied" | "available" = occupied ? "occupied" : "available";
          return { id: table.id, tableName: table.tableName, seats: table.seats, location: table.location, status };
        })
        .sort((a, b) => a.tableName.localeCompare(b.tableName, undefined, { numeric: true }));
    },
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────

async function getRules(app: App, restaurantId: string): Promise<ReservationRulesConfig> {
  const [row] = await app.db
    .select()
    .from(reservationRules)
    .where(eq(reservationRules.restaurantId, restaurantId))
    .limit(1);
  if (!row) throw new Error("reservation_rules row missing for this restaurant — was it seeded?");
  return row;
}

async function getDayHours(app: App, restaurantId: string, date: string) {
  const pgDayOfWeek = Temporal.PlainDate.from(date).dayOfWeek % 7;
  const [row] = await app.db
    .select()
    .from(availabilitySettings)
    .where(
      and(eq(availabilitySettings.restaurantId, restaurantId), eq(availabilitySettings.dayOfWeek, pgDayOfWeek)),
    )
    .limit(1);
  return row;
}

async function isDateBlocked(app: App, restaurantId: string, date: string): Promise<boolean> {
  const [row] = await app.db
    .select({ id: blockedDates.id })
    .from(blockedDates)
    .where(and(eq(blockedDates.restaurantId, restaurantId), eq(blockedDates.blockedDate, date)))
    .limit(1);
  return Boolean(row);
}

async function getFittingTables(app: App, restaurantId: string, partySize: number) {
  const rows = await app.db
    .select()
    .from(tables)
    .where(and(eq(tables.restaurantId, restaurantId), eq(tables.status, "active")));
  return rows.filter((t) => t.seats >= partySize);
}

interface LiveReservation {
  tableId: string | null;
  reservationTime: string;
  durationMinutes: number;
  partySize: number;
  status: (typeof LIVE_STATUSES)[number];
}

async function getLiveReservations(
  app: App,
  restaurantId: string,
  date: string,
): Promise<LiveReservation[]> {
  return app.db
    .select({
      tableId: reservations.tableId,
      reservationTime: reservations.reservationTime,
      durationMinutes: reservations.durationMinutes,
      partySize: reservations.partySize,
      status: reservations.status,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        eq(reservations.reservationDate, date),
        inArray(reservations.status, [...LIVE_STATUSES]),
      ),
    ) as Promise<LiveReservation[]>;
}

function hasOverlap(
  dayReservations: LiveReservation[],
  tableId: string,
  startTime: string,
  endTime: string,
): boolean {
  return dayReservations.some(
    (r) =>
      r.tableId === tableId &&
      timeRangesOverlap(startTime, endTime, r.reservationTime, addMinutes(r.reservationTime, r.durationMinutes)),
  );
}

/** Overflow already accepted for one exact slot start time — status
 *  'overflow' specifically, since that is what "accepted beyond the table
 *  grid" means (proposal §07); 'requested'/'waitlisted' are still pending
 *  and have not consumed any of the allowance yet. */
function summarizeOverflow(dayReservations: LiveReservation[], slotStart: string) {
  const matching = dayReservations.filter(
    (r) => r.status === "overflow" && normalizeTime(r.reservationTime) === normalizeTime(slotStart),
  );
  return {
    parties: matching.length,
    covers: matching.reduce((sum, r) => sum + r.partySize, 0),
  };
}

function toDaysApprox(value: number, unit: "hours" | "days"): number {
  return unit === "days" ? value : Math.ceil(value / 24);
}
