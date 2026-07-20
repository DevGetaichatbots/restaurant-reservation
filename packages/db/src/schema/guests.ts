import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { restaurant } from "./restaurant.js";

/**
 * Guests, keyed on phone.
 *
 * Required to make the Customers page real: reservations only copy a name and
 * phone, so without this table there is no customer record to show. Visit and
 * no-show counts are denormalised here so the Customers list does not aggregate
 * the whole reservations table on every load.
 */
export const guests = pgTable(
  "guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),

    name: text("name"),
    phone: text("phone"),
    email: text("email"),

    visitCount: integer("visit_count").notNull().default(0),
    noShowCount: integer("no_show_count").notNull().default(0),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),

    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("guests_contactable", sql`${t.phone} is not null or ${t.email} is not null`),
    uniqueIndex("guests_unique_phone")
      .on(t.restaurantId, t.phone)
      .where(sql`${t.phone} is not null`),
    uniqueIndex("guests_unique_email")
      .on(t.restaurantId, t.email)
      .where(sql`${t.email} is not null`),
  ],
);

export const guestsRelations = relations(guests, ({ one }) => ({
  restaurant: one(restaurant, {
    fields: [guests.restaurantId],
    references: [restaurant.id],
  }),
}));

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
