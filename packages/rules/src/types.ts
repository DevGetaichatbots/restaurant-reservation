/**
 * Shapes shared by every rule function.
 *
 * These mirror the `reservation_rules` row (packages/db/src/schema/rules.ts)
 * field for field. Kept as a plain interface here — rather than importing the
 * Drizzle table type — so this package stays free of any database dependency
 * and can be imported by a browser bundle with nothing dragged along.
 */

export type TimeUnit = "hours" | "days";

export type BookingMode = "automatic" | "manual" | "auto_then_manual";

export interface ReservationRulesConfig {
  minAdvanceBooking: number;
  minAdvanceUnit: TimeUnit;

  maxAdvanceBooking: number;
  maxAdvanceUnit: TimeUnit;

  cancellationTimeLimit: number;
  cancellationTimeUnit: TimeUnit;

  maxGuestsPerBooking: number;

  allowSameDayBooking: boolean;
  requireContactInformation: boolean;

  bookingMode: BookingMode;

  overflowPartiesPerSlot: number;
  overflowCoversPerSlot: number;
  allowWaitlist: boolean;

  requestExpiryMinutes: number;
  requestExpiryCutoffMinutes: number;
  requestExpiryFloorMinutes: number;
  urgentThresholdMinutes: number;
}

/**
 * The outcome of one rule check.
 *
 * `rule` is a stable, machine-readable name — the API's error handler attaches
 * it to the response so a front-end can point the guest at the exact step that
 * needs changing, rather than showing a generic failure. `message` is written
 * for the guest to read directly.
 */
export type RuleResult =
  | { ok: true }
  | { ok: false; rule: string; message: string };

export function pass(): RuleResult {
  return { ok: true };
}

export function fail(rule: string, message: string): RuleResult {
  return { ok: false, rule, message };
}

/** A calendar date and a time-of-day, exactly as the guest picked them —
 *  before any timezone reasoning is applied. */
export interface LocalDateTime {
  /** ISO calendar date, e.g. "2026-08-14". */
  date: string;
  /** 24-hour time, e.g. "19:30". */
  time: string;
}

/** Minimal contact fields a rule needs to check — never a full guest record. */
export interface ContactInfo {
  phone?: string | null;
  email?: string | null;
}
