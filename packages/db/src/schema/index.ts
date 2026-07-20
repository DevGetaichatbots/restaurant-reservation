/**
 * Schema barrel.
 *
 * Exported in dependency order, which is also the order the migrations create
 * them in (proposal §05, migrations M1–M8). Nothing may reference a table
 * declared below it.
 *
 * Built so far:
 *   M1  enums, restaurant          ✅
 *   M2  tables                     ✅
 *
 * Next, in this order:
 *   M3  availability_settings, time_slots
 *   M4  blocked_dates, reservation_rules
 *   M5  guests
 *   M6  reservations + the partial exclusion constraint   ← the critical one
 *   M7  reservation_events + NOTIFY triggers
 *   M8  indexes + seed data (Tables 1–7)
 */

export * from "./enums.js";
export * from "./restaurant.js";
export * from "./tables.js";
