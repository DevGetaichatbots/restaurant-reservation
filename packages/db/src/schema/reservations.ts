import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { reservationSource, reservationStatus } from "./enums.js";
import { guests } from "./guests.js";
import { restaurant } from "./restaurant.js";
import { tables } from "./tables.js";

/**
 * Reservations — the core table.
 *
 * Note what is NOT modelled here: the `slot_range` column. It is a GENERATED
 * column (see migration 0004) computed by PostgreSQL from the date, time and
 * duration, and it exists solely for the exclusion constraint to operate on.
 * Application code never reads or writes it, so it is deliberately absent from
 * this type — its home is the SQL, where it is defined once and cannot drift.
 *
 * `tableId` is nullable on purpose: a booking that is still a request holds no
 * table, which is what lets the restaurant accept guests beyond its grid
 * without weakening the double-booking guarantee. See proposal §07.
 */
export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),

    tableId: uuid("table_id").references(() => tables.id, { onDelete: "restrict" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),

    guestName: text("guest_name").notNull(),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),

    partySize: integer("party_size").notNull(),

    reservationDate: date("reservation_date").notNull(),
    reservationTime: time("reservation_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),

    status: reservationStatus("status").notNull().default("requested"),
    isOverflow: boolean("is_overflow").notNull().default(false),

    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    source: reservationSource("source").notNull().default("direct"),

    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by"),

    idempotencyKey: text("idempotency_key"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("reservations_party_positive", sql`${t.partySize} > 0`),
    check("reservations_duration_positive", sql`${t.durationMinutes} > 0`),
    check(
      "reservations_seated_needs_table",
      sql`${t.status} not in ('confirmed','seated','completed') or ${t.tableId} is not null`,
    ),
    uniqueIndex("reservations_idempotency")
      .on(t.restaurantId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

/**
 * Append-only audit log. Every status change lands here, which is what makes
 * the Reports page possible and settles "who cancelled this and when".
 */
export const reservationEvents = pgTable("reservation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  reservationId: uuid("reservation_id")
    .notNull()
    .references(() => reservations.id, { onDelete: "cascade" }),
  fromStatus: reservationStatus("from_status"),
  toStatus: reservationStatus("to_status").notNull(),
  actor: text("actor").notNull().default("system"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  restaurant: one(restaurant, {
    fields: [reservations.restaurantId],
    references: [restaurant.id],
  }),
  table: one(tables, { fields: [reservations.tableId], references: [tables.id] }),
  guest: one(guests, { fields: [reservations.guestId], references: [guests.id] }),
  events: many(reservationEvents),
}));

export const reservationEventsRelations = relations(reservationEvents, ({ one }) => ({
  reservation: one(reservations, {
    fields: [reservationEvents.reservationId],
    references: [reservations.id],
  }),
}));

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type ReservationEvent = typeof reservationEvents.$inferSelect;
export type NewReservationEvent = typeof reservationEvents.$inferInsert;
