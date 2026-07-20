import { relations, sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { bookingMode, timeUnit } from "./enums.js";
import { restaurant } from "./restaurant.js";

/**
 * The policy the restaurant books by. One row per restaurant.
 *
 * Every value is enforced server-side on each booking. `bookingMode` replaces
 * the brief's auto_confirm boolean; the overflow and expiry fields drive the
 * flexible-capacity behaviour in proposal §07.
 */
export const reservationRules = pgTable(
  "reservation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .unique()
      .references(() => restaurant.id, { onDelete: "cascade" }),

    minAdvanceBooking: integer("min_advance_booking").notNull().default(2),
    minAdvanceUnit: timeUnit("min_advance_unit").notNull().default("hours"),

    maxAdvanceBooking: integer("max_advance_booking").notNull().default(60),
    maxAdvanceUnit: timeUnit("max_advance_unit").notNull().default("days"),

    cancellationTimeLimit: integer("cancellation_time_limit").notNull().default(4),
    cancellationTimeUnit: timeUnit("cancellation_time_unit").notNull().default("hours"),

    maxGuestsPerBooking: integer("max_guests_per_booking").notNull().default(12),

    allowSameDayBooking: boolean("allow_same_day_booking").notNull().default(true),
    requireContactInformation: boolean("require_contact_information").notNull().default(true),

    bookingMode: bookingMode("booking_mode").notNull().default("auto_then_manual"),

    overflowPartiesPerSlot: integer("overflow_parties_per_slot").notNull().default(3),
    overflowCoversPerSlot: integer("overflow_covers_per_slot").notNull().default(12),
    allowWaitlist: boolean("allow_waitlist").notNull().default(true),

    requestExpiryMinutes: integer("request_expiry_minutes").notNull().default(90),
    requestExpiryCutoffMinutes: integer("request_expiry_cutoff_minutes").notNull().default(120),
    requestExpiryFloorMinutes: integer("request_expiry_floor_minutes").notNull().default(20),
    urgentThresholdMinutes: integer("urgent_threshold_minutes").notNull().default(45),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("rules_max_guests_positive", sql`${t.maxGuestsPerBooking} > 0`),
    check(
      "rules_overflow_non_negative",
      sql`${t.overflowPartiesPerSlot} >= 0 and ${t.overflowCoversPerSlot} >= 0`,
    ),
    check(
      "rules_expiry_sane",
      sql`${t.requestExpiryMinutes} > 0 and ${t.requestExpiryFloorMinutes} > 0 and ${t.requestExpiryFloorMinutes} <= ${t.requestExpiryMinutes}`,
    ),
  ],
);

export const reservationRulesRelations = relations(reservationRules, ({ one }) => ({
  restaurant: one(restaurant, {
    fields: [reservationRules.restaurantId],
    references: [restaurant.id],
  }),
}));

export type ReservationRules = typeof reservationRules.$inferSelect;
export type NewReservationRules = typeof reservationRules.$inferInsert;
