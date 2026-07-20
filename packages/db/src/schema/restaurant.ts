import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * The restaurant itself. A single row today.
 *
 * Not in the original brief, and added for one reason above all: `timezone`.
 * Without a stored timezone, "7:30 PM" means whatever the reader's device
 * thinks it means, and a guest booking from another country gets the wrong
 * hour. Every rule in the system is evaluated against this value rather than
 * against a browser clock. (Proposal §12, edge case E-01.)
 *
 * Keeping it as a table rather than a config file also means a second location
 * later is a new row, not a rebuild.
 */
export const restaurant = pgTable("restaurant", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(),

  /** IANA zone, e.g. "Asia/Karachi". Never a fixed UTC offset — those break
   *  across daylight-saving changes. */
  timezone: text("timezone").notNull().default("Asia/Karachi"),

  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  logoUrl: text("logo_url"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Restaurant = typeof restaurant.$inferSelect;
export type NewRestaurant = typeof restaurant.$inferInsert;
