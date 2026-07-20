import { Temporal } from "temporal-polyfill";

import { minutesBetween, nowIn, toZonedDateTime } from "./clock.js";
import type { LocalDateTime, ReservationRulesConfig } from "./types.js";

type ExpiryRules = Pick<
  ReservationRulesConfig,
  "requestExpiryMinutes" | "requestExpiryCutoffMinutes" | "requestExpiryFloorMinutes"
>;

/**
 * When an unanswered request lapses.
 *
 * D-11 specified "90 minutes, or 2 hours before the slot — whichever comes
 * first". Taken literally that breaks for a request made close to its own
 * slot: a request at 6:00 PM for a 7:30 PM table computes a cutoff of 5:30 PM,
 * which is already in the past, so the request would expire the instant it
 * was created.
 *
 * `requestExpiryFloorMinutes` fixes that: the expiry can never land sooner
 * than the floor after the request was made, however tight the slot is. A
 * request that would otherwise expire immediately instead gets a short but
 * real window — and `isRequestUrgent` below is what tells the staff tablet to
 * alert loudly rather than rely on an unread email.
 */
export function computeRequestExpiry(
  target: LocalDateTime,
  timezone: string,
  rules: ExpiryRules,
  requestedAt = nowIn(timezone),
): Temporal.ZonedDateTime {
  const targetInstant = toZonedDateTime(target, timezone);

  const byDuration = requestedAt.add({ minutes: rules.requestExpiryMinutes });
  const byCutoff = targetInstant.subtract({ minutes: rules.requestExpiryCutoffMinutes });

  const earliest =
    Temporal.ZonedDateTime.compare(byDuration, byCutoff) < 0 ? byDuration : byCutoff;

  const floor = requestedAt.add({ minutes: rules.requestExpiryFloorMinutes });

  return Temporal.ZonedDateTime.compare(earliest, floor) < 0 ? floor : earliest;
}

/**
 * Whether a still-pending request is close enough to its own expiry that it
 * should interrupt someone rather than wait in a list.
 *
 * The staff tablet uses this to decide between a quiet badge and a sound
 * alert; email is deliberately not the channel for this — nobody checks email
 * mid-service.
 */
export function isRequestUrgent(
  expiresAt: Temporal.ZonedDateTime,
  rules: Pick<ReservationRulesConfig, "urgentThresholdMinutes">,
  now: Temporal.ZonedDateTime,
): boolean {
  return minutesBetween(now, expiresAt) <= rules.urgentThresholdMinutes;
}
