/**
 * The booking rules, as pure functions.
 *
 * Pure means: given the same inputs they always return the same answer, they
 * touch no database and no clock of their own — every function that needs
 * "now" takes it as a parameter with a real default, so tests can pin exact
 * boundaries instead of racing the system clock.
 *
 * The API is the only thing that *enforces* these — see apps/api's write path,
 * which re-runs every check inside the transaction regardless of what the
 * client already validated. The front-ends import the same functions purely
 * to preview an outcome and grey out what would be refused — a browser's
 * opinion is never trusted on its own.
 *
 * Status:
 *   ✅ advance-window     — rules 1, 2, and same-day (rule 4)
 *   ✅ cancellation       — rule 3 (needs the manage-booking page, D-01)
 *   ✅ party-size         — rule 5, plus table-capacity
 *   ✅ contact-info       — rule 6
 *   ✅ booking-mode       — replaces rule 7; the confirmed/requested/
 *                           waitlisted/unavailable decision from §07
 *   ✅ request-expiry     — D-11, including the floor that fixes the
 *                           tight-slot edge case
 */

export * from "./types.js";
export * from "./clock.js";
export * from "./advance-window.js";
export * from "./cancellation.js";
export * from "./party-size.js";
export * from "./contact-info.js";
export * from "./booking-mode.js";
export * from "./request-expiry.js";
