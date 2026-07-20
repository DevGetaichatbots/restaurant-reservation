import { describe, expect, it } from "vitest";

import { checkCancellationAllowed } from "../cancellation.js";
import { toZonedDateTime } from "../clock.js";
import type { LocalDateTime, ReservationRulesConfig } from "../types.js";

const TZ = "Asia/Karachi";

// Fixed reference instant — see advance-window.test.ts for why the real
// clock's seconds precision would make boundary tests flaky.
function fixedNow() {
  return toZonedDateTime({ date: "2026-05-01", time: "12:00" }, TZ);
}

const rules: ReservationRulesConfig = {
  minAdvanceBooking: 2,
  minAdvanceUnit: "hours",
  maxAdvanceBooking: 60,
  maxAdvanceUnit: "days",
  cancellationTimeLimit: 4,
  cancellationTimeUnit: "hours",
  maxGuestsPerBooking: 12,
  allowSameDayBooking: true,
  requireContactInformation: true,
  bookingMode: "auto_then_manual",
  overflowPartiesPerSlot: 3,
  overflowCoversPerSlot: 12,
  allowWaitlist: true,
  requestExpiryMinutes: 90,
  requestExpiryCutoffMinutes: 120,
  requestExpiryFloorMinutes: 20,
  urgentThresholdMinutes: 45,
};

function localAt(now: ReturnType<typeof fixedNow>, offsetMinutes: number): LocalDateTime {
  const target = now.add({ minutes: offsetMinutes });
  return {
    date: target.toPlainDate().toString(),
    time: target.toPlainTime().toString().slice(0, 5),
  };
}

describe("checkCancellationAllowed", () => {
  const now = fixedNow();

  it("allows cancelling well outside the limit", () => {
    const result = checkCancellationAllowed(localAt(now, 24 * 60), rules, TZ, now);
    expect(result.ok).toBe(true);
  });

  it("allows cancelling at exactly the limit", () => {
    // limit = 4 hours = 240 minutes
    const result = checkCancellationAllowed(localAt(now, 240), rules, TZ, now);
    expect(result.ok).toBe(true);
  });

  it("rejects cancelling one minute inside the limit", () => {
    const result = checkCancellationAllowed(localAt(now, 239), rules, TZ, now);
    expect(result).toMatchObject({ ok: false, rule: "cancellation_time_limit" });
  });

  it("rejects cancelling a booking that starts imminently", () => {
    const result = checkCancellationAllowed(localAt(now, 10), rules, TZ, now);
    expect(result.ok).toBe(false);
  });
});
