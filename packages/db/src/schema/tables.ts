import { relations } from "drizzle-orm";
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
import { sql } from "drizzle-orm";

import { tableStatus } from "./enums.js";
import { restaurant } from "./restaurant.js";

/**
 * Physical tables in the restaurant.
 *
 * Note there is no hard delete. A table with bookings against it must never
 * vanish — that would orphan real reservations — so removal sets `archivedAt`
 * and the row stays. (Proposal §12, edge case E-07.)
 */
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),

    /** Human-facing name, e.g. "Table 5". Unique among live tables — two
     *  "Table 5"s is an incident on the floor, not a data curiosity. */
    tableName: text("table_name").notNull(),

    seats: integer("seats").notNull(),

    /** Main Hall, Terrace, VIP Room, Window Area — or anything the owner types. */
    location: text("location").notNull().default("Main Hall"),

    /** Inactive tables keep their existing bookings but accept no new ones.
     *  (Proposal §12, edge case E-06.) */
    status: tableStatus("status").notNull().default("active"),

    /** Put out for one evening to absorb overflow. Flagged so Reports can tell
     *  normal capacity apart from capacity the restaurant flexed into. (§07) */
    isTemporary: boolean("is_temporary").notNull().default(false),

    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Enforced in the database, not just the admin form: a duplicate name can
    // otherwise arrive through the API or a direct SQL session.
    uniqueIndex("tables_unique_name_per_restaurant")
      .on(table.restaurantId, table.tableName)
      .where(sql`${table.archivedAt} is null`),

    check("tables_seats_positive", sql`${table.seats} > 0`),
  ],
);

export const tablesRelations = relations(tables, ({ one }) => ({
  restaurant: one(restaurant, {
    fields: [tables.restaurantId],
    references: [restaurant.id],
  }),
}));

export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;
