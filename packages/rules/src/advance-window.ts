import { Temporal } from "temporal-polyfill";

import { nowIn, toDuration, toZonedDateTime } from "./clock.js";
import { fail, pass, type LocalDateTime, type ReservationRulesConfig, type RuleResult } from "./types.js";

/**
 * Rules 1 & 2 from the brief — minimum and maximum advance booking.
 *
 * "Now" is passed in explicitly rather than read from the system clock, so the
 * exact boundary (a booking one minute inside vs. outside the window) can be
 * tested deterministically instead of racing real time.
 */
export function checkAdvanceWindow(
  target: LocalDateTime,
  rules: ReservationRulesConfig,
  timezone: string,
  now = nowIn(timezone),
): RuleResult {
  const targetInstant = toZonedDateTime(target, timezone);

  const earliestAllowed = now.add(toDuration(rules.minAdvanceBooking, rules.minAdvanceUnit));
  const latestAllowed = now.add(toDuration(rules.maxAdvanceBooking, rules.maxAdvanceUnit));

  if (Temporal.ZonedDateTime.compare(targetInstant, now) < 0) {
    return fail("advance_window", "That time has already passed.");
  }

  if (Temporal.ZonedDateTime.compare(targetInstant, earliestAllowed) < 0) {
    return fail(
      "advance_window",
      `Bookings need at least ${rules.minAdvanceBooking} ${rules.minAdvanceUnit} notice.`,
    );
  }

  if (Temporal.ZonedDateTime.compare(targetInstant, latestAllowed) > 0) {
    return fail(
      "advance_window",
      `Bookings can be made at most ${rules.maxAdvanceBooking} ${rules.maxAdvanceUnit} ahead.`,
    );
  }

  return pass();
}

/**
 * Rule — same-day booking.
 *
 * Checked separately from the advance window: a restaurant might allow
 * same-day bookings generally (min advance = 2 hours) but forbid them entirely
 * on principle (allowSameDayBooking = false), and the two need independent
 * messages so the guest understands which policy stopped them.
 */
export function checkSameDayAllowed(
  target: LocalDateTime,
  rules: ReservationRulesConfig,
  timezone: string,
  now = nowIn(timezone),
): RuleResult {
  if (rules.allowSameDayBooking) return pass();

  const targetInstant = toZonedDateTime(target, timezone);
  const isSameCalendarDay =
    targetInstant.year === now.year && targetInstant.month === now.month && targetInstant.day === now.day;

  if (isSameCalendarDay) {
    return fail("same_day_booking", "Same-day bookings aren't available — please choose a later date.");
  }

  return pass();
}
