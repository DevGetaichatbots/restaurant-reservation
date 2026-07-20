import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { restaurant } from "./restaurant.js";

export const staffRole = pgEnum("staff_role", ["admin", "staff"]);

/**
 * Login accounts for the admin dashboard and staff tablet.
 *
 * Interim, not final: proposal §03 commits to Amazon Cognito, which needs an
 * AWS account the client has not yet provided. This table stores exactly what
 * a JWT needs as claims — id, role, restaurant — and nothing Cognito-specific,
 * so the later migration is "verify against Cognito's JWKS instead of our own
 * signature", not a rewrite of every protected route.
 */
export const staffAccounts = pgTable(
  "staff_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: staffRole("role").notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("staff_accounts_unique_email").on(t.restaurantId, t.email)],
);

export const staffAccountsRelations = relations(staffAccounts, ({ one }) => ({
  restaurant: one(restaurant, { fields: [staffAccounts.restaurantId], references: [restaurant.id] }),
}));

export type StaffAccount = typeof staffAccounts.$inferSelect;
export type NewStaffAccount = typeof staffAccounts.$inferInsert;
