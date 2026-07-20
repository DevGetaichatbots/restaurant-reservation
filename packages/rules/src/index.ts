/**
 * The booking rules, as pure functions.
 *
 * Pure means: given the same inputs they always return the same answer, they
 * touch no database and no clock of their own. That makes every rule directly
 * unit-testable at its boundaries — the minute either side of a cutoff, the
 * exact seat count, the first blocked date — which is how we know they are
 * right before any interface exists.
 *
 * The API is the only thing that enforces them. The front-ends import the same
 * functions to preview an outcome and grey out what would be refused, but a
 * browser's opinion is never trusted: everything is re-checked server-side
 * inside the write transaction.
 *
 * To implement in Sprint 1:
 *   • minimum / maximum advance booking window
 *   • cancellation time limit
 *   • max guests per booking
 *   • same-day booking allowed
 *   • contact information required
 *   • booking mode routing → confirmed | requested | waitlisted   (§07)
 *   • overflow allowance and the capacity meter                   (§07)
 *   • request expiry, including the 20-minute floor               (§13 D-11)
 */

export {};
