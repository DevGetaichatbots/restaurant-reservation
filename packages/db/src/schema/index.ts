/**
 * Schema barrel.
 *
 * Exported in dependency order, which is also the order the migrations create
 * them in (proposal §05). Nothing may reference a table declared below it.
 *
 * Built:
 *   M1  enums, restaurant                                   ✅
 *   M2  tables                                              ✅
 *   M3  availability_settings, time_slots, blocked_dates    ✅
 *   M4  reservation_rules                                   ✅
 *   M5  guests                                              ✅
 *   M6  reservations + partial exclusion constraint         ✅
 *   M7  reservation_events + NOTIFY / updated_at triggers   ✅
 *
 * Next:
 *   M8  seed data (Tables 1–7, opening hours, slots, rules)
 */

export * from "./enums.js";
export * from "./restaurant.js";
export * from "./tables.js";
export * from "./availability.js";
export * from "./rules.js";
export * from "./guests.js";
export * from "./reservations.js";
