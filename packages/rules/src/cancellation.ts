import { Temporal } from "temporal-polyfill";

import { nowIn, toDuration, toZonedDateTime } from "./clock.js";
import { fail, pass, type LocalDateTime, type ReservationRulesConfig, type RuleResult } from "./types.js";

/**
 * Rule — cancellation time limit.
 *
 * This is the rule that made §08's manage-booking page necessary in the first
 * place (D-01): a limit that governs cancelling only makes sense once a guest
 * has somewhere to cancel from. Called from the PATCH endpoint that page hits.
 */
export function checkCancellationAllowed(
  target: LocalDateTime,
  rules: ReservationRulesConfig,
  timezone: string,
  now = nowIn(timezone),
): RuleResult {
  const targetInstant = toZonedDateTime(target, timezone);
  const deadline = targetInstant.subtract(
    toDuration(rules.cancellationTimeLimit, rules.cancellationTimeUnit),
  );

  if (Temporal.ZonedDateTime.compare(now, deadline) > 0) {
    return fail(
      "cancellation_time_limit",
      `Cancellations need at least ${rules.cancellationTimeLimit} ${rules.cancellationTimeUnit} notice. Please call the restaurant directly.`,
    );
  }

  return pass();
}
