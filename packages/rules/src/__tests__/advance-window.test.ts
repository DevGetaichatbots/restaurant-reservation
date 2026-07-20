import { describe, expect, it } from "vitest";

import { checkAdvanceWindow, checkSameDayAllowed } from "../advance-window.js";
import { toZonedDateTime } from "../clock.js";
import type { LocalDateTime, ReservationRulesConfig } from "../types.js";

const TZ = "Asia/Karachi";

// A fixed reference instant, not the real wall clock. Slot times are always
// minute-precise (no seconds), and `now` in production carries real seconds —
// comparing "now + 120 minutes" against a minute-truncated target would be
// flaky by up to 59 seconds if `now` weren't pinned here.
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

describe("checkAdvanceWindow", () => {
  const now = fixedNow();

  it("rejects a time that has already passed", () => {
    const result = checkAdvanceWindow(localAt(now, -30), rules, TZ, now);
    expect(result.ok).toBe(false);
  });

  it("rejects one minute inside the minimum advance window", () => {
    // min advance = 2 hours = 120 minutes; 119 minutes out is inside it
    const result = checkAdvanceWindow(localAt(now, 119), rules, TZ, now);
    expect(result).toMatchObject({ ok: false, rule: "advance_window" });
  });

  it("allows exactly the minimum advance window", () => {
    const result = checkAdvanceWindow(localAt(now, 120), rules, TZ, now);
    expect(result.ok).toBe(true);
  });

  it("allows one minute past the minimum advance window", () => {
    const result = checkAdvanceWindow(localAt(now, 121), rules, TZ, now);
    expect(result.ok).toBe(true);
  });

  it("allows a booking exactly at the maximum advance window", () => {
    const result = checkAdvanceWindow(localAt(now, 60 * 24 * 60), rules, TZ, now);
    expect(result.ok).toBe(true);
  });

  it("rejects a booking one day past the maximum advance window", () => {
    const result = checkAdvanceWindow(localAt(now, 61 * 24 * 60), rules, TZ, now);
    expect(result).toMatchObject({ ok: false, rule: "advance_window" });
  });
});

describe("checkSameDayAllowed", () => {
  const now = fixedNow();

  it("allows a same-day booking when the rule permits it", () => {
    const result = checkSameDayAllowed(localAt(now, 180), { ...rules, allowSameDayBooking: true }, TZ, now);
    expect(result.ok).toBe(true);
  });

  it("rejects a same-day booking when the rule forbids it", () => {
    const result = checkSameDayAllowed(
      localAt(now, 180),
      { ...rules, allowSameDayBooking: false },
      TZ,
      now,
    );
    expect(result).toMatchObject({ ok: false, rule: "same_day_booking" });
  });

  it("allows tomorrow even when same-day is forbidden", () => {
    const result = checkSameDayAllowed(
      localAt(now, 24 * 60 + 60),
      { ...rules, allowSameDayBooking: false },
      TZ,
      now,
    );
    expect(result.ok).toBe(true);
  });
});

describe("toZonedDateTime — timezone correctness", () => {
  it("produces the restaurant's local time regardless of the runtime's own timezone", () => {
    const target: LocalDateTime = { date: "2026-08-14", time: "19:30" };
    const zdt = toZonedDateTime(target, TZ);

    expect(zdt.hour).toBe(19);
    expect(zdt.minute).toBe(30);
    expect(zdt.timeZoneId).toBe(TZ);
  });
});
