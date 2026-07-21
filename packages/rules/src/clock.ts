import { Temporal } from "temporal-polyfill";

import type { LocalDateTime, TimeUnit } from "./types.js";

/**
 * All the timezone reasoning this package needs, in one place.
 *
 * Proposal §12, edge case E-01: "7:30 PM" means a different instant depending
 * on whose clock reads it. Every function below takes the restaurant's IANA
 * timezone explicitly and never touches `new Date()` or a browser clock — the
 * caller decides what "now" is, which is what makes these functions pure and
 * testable at exact boundaries instead of racing the real clock.
 */

/**
 * Combines a guest's chosen date and time with the restaurant's timezone into
 * a precise instant.
 *
 * Uses Temporal rather than the built-in Date: converting a local time to an
 * absolute instant is not well-defined for a moment a clock change skips or
 * repeats, and Temporal makes that ambiguity a decision instead of a silent
 * bug (§12, edge case E-02).
 */
export function toZonedDateTime(local: LocalDateTime, timezone: string): Temporal.ZonedDateTime {
  const [year, month, day] = local.date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = local.time.split(":").map(Number) as [number, number];

  return Temporal.ZonedDateTime.from(
    { timeZone: timezone, year, month, day, hour, minute },
    // A booking landing in a skipped daylight-saving hour is pushed forward
    // to the next valid instant rather than silently accepted or rejected —
    // slot generation is responsible for never offering such a time at all.
    { disambiguation: "compatible" },
  );
}

/** The current instant, expressed in the restaurant's timezone. */
export function nowIn(timezone: string): Temporal.ZonedDateTime {
  return Temporal.Now.zonedDateTimeISO(timezone);
}

/**
 * Converts a stored instant — a `timestamptz` column read back as a JS
 * `Date`, e.g. `requestedAt` or `expiresAt` — into the restaurant's local
 * timezone, so it can be compared with `minutesBetween`/`isRequestUrgent`
 * alongside values produced by `nowIn`.
 */
export function fromInstant(date: Date, timezone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timezone);
}

/** Converts a rule's { value, unit } pair into a Temporal.Duration. */
export function toDuration(value: number, unit: TimeUnit): Temporal.Duration {
  return unit === "hours" ? Temporal.Duration.from({ hours: value }) : Temporal.Duration.from({ days: value });
}

/** Whole minutes between two instants. Negative if `to` is before `from`. */
export function minutesBetween(from: Temporal.ZonedDateTime, to: Temporal.ZonedDateTime): number {
  return Math.floor(from.until(to, { largestUnit: "minutes" }).total("minutes"));
}
