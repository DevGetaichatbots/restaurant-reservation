import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { restaurant } from "./restaurant.js";

/**
 * Opening hours — one row per day of week.
 *
 * `dayOfWeek` follows PostgreSQL's own convention (0 = Sunday … 6 = Saturday),
 * so comparing a date to its schedule never needs an off-by-one adjustment.
 *
 * There is intentionally no check that closeTime is after openTime: a close
 * before the open means service past midnight, which is normal.
 */
export const availabilitySettings = pgTable(
  "availability_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    openTime: time("open_time").notNull(),
    closeTime: time("close_time").notNull(),
    isOpen: boolean("is_open").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("availability_day_valid", sql`${t.dayOfWeek} between 0 and 6`),
    unique("availability_one_row_per_day").on(t.restaurantId, t.dayOfWeek),
  ],
);

/**
 * Bookable time increments, e.g. 30-minute slots.
 *
 * `durationMinutes` is how long a booking made in this slot holds its table —
 * the value the double-booking constraint measures overlap against. It is
 * usually longer than the gap between slot starts.
 */
export const timeSlots = pgTable(
  "time_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("time_slots_duration_positive", sql`${t.durationMinutes} > 0`),
    unique("time_slots_unique_start").on(t.restaurantId, t.startTime),
  ],
);

/**
 * Dates the restaurant will not take bookings on. Overrides opening hours.
 * Blocking a date never cancels bookings already on it — that is the admin's
 * explicit decision, never automatic.
 */
export const blockedDates = pgTable(
  "blocked_dates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    blockedDate: date("blocked_date").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("blocked_dates_unique").on(t.restaurantId, t.blockedDate)],
);

export const availabilitySettingsRelations = relations(availabilitySettings, ({ one }) => ({
  restaurant: one(restaurant, {
    fields: [availabilitySettings.restaurantId],
    references: [restaurant.id],
  }),
}));

export type AvailabilitySetting = typeof availabilitySettings.$inferSelect;
export type NewAvailabilitySetting = typeof availabilitySettings.$inferInsert;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type NewTimeSlot = typeof timeSlots.$inferInsert;
export type BlockedDate = typeof blockedDates.$inferSelect;
export type NewBlockedDate = typeof blockedDates.$inferInsert;
