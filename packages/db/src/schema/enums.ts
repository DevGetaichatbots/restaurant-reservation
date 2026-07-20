import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Reservation status.
 *
 * The brief's original list was Pending → Confirmed → Seated → Completed →
 * Cancelled. Four values are added, each for a reason recorded in the proposal:
 *
 *   requested   a guest asked for a slot with no free table, or the restaurant
 *               is in manual mode. Waiting on a human decision. (§07)
 *   waitlisted  past the overflow allowance — accepted onto a waiting list
 *               rather than refused, so no guest is turned away. (§07)
 *   overflow    accepted beyond the table grid; the restaurant has committed
 *               but has not yet decided which table. (§07)
 *   declined    the restaurant could not accommodate this one.
 *   expired     nobody answered in time. (§13 D-11)
 *   no_show     the guest never arrived. Without this, no-shows get recorded
 *               as `completed` and every occupancy report becomes wrong. (§13 D-05)
 */
export const reservationStatus = pgEnum("reservation_status", [
  "requested",
  "waitlisted",
  "confirmed",
  "overflow",
  "seated",
  "completed",
  "cancelled",
  "declined",
  "expired",
  "no_show",
]);

/**
 * Who decides whether a booking is accepted. Replaces the brief's
 * `auto_confirm_reservations` boolean, which could not express the way this
 * restaurant actually works. (§07)
 *
 *   automatic          free table → confirmed. No free table → the slot closes.
 *   manual             every booking waits for a human, free table or not.
 *   auto_then_manual   free table → confirmed. No free table → request queue
 *                      opens. This is the default.
 */
export const bookingMode = pgEnum("booking_mode", [
  "automatic",
  "manual",
  "auto_then_manual",
]);

/** Where a booking came from. Lets Reports prove the Google link is working. */
export const reservationSource = pgEnum("reservation_source", [
  "gmb",
  "direct",
  "walk_in",
  "phone",
]);

/** Whether a table can currently be booked. */
export const tableStatus = pgEnum("table_status", ["active", "inactive"]);

/** Units for the advance-booking and cancellation windows. */
export const timeUnit = pgEnum("time_unit", ["hours", "days"]);
