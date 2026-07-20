import { describe, expect, it } from "vitest";

import { minutesBetween, toZonedDateTime } from "../clock.js";
import { computeRequestExpiry, isRequestUrgent } from "../request-expiry.js";
import type { LocalDateTime, ReservationRulesConfig } from "../types.js";

const TZ = "Asia/Karachi";

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

describe("computeRequestExpiry", () => {
  /**
   * Case A from the walkthrough: a request at 5:00 PM for a 7:30 PM slot.
   *   by-duration: 5:00 + 90min = 6:30
   *   by-cutoff:   7:30 - 120min = 5:30
   *   earliest:    5:30 — comfortably after the request was made, no floor needed
   */
  it("uses the tighter of duration and cutoff when both are comfortably in the future", () => {
    const requestedAt = toZonedDateTime({ date: "2026-05-14", time: "17:00" }, TZ);
    const target: LocalDateTime = { date: "2026-05-14", time: "19:30" };

    const expiry = computeRequestExpiry(target, TZ, rules, requestedAt);

    expect(expiry.hour).toBe(17);
    expect(expiry.minute).toBe(30);
  });

  /**
   * Case B — the bug this floor exists to fix. A request at 6:00 PM for the
   * same 7:30 PM slot:
   *   by-duration: 6:00 + 90min = 7:30
   *   by-cutoff:   7:30 - 120min = 5:30  (already in the past relative to 6:00!)
   *   naive earliest: 5:30 — expires before it was even created
   *   floor: 6:00 + 20min = 6:20 — what should actually be used
   */
  it("applies the floor when the naive computation would expire in the past", () => {
    const requestedAt = toZonedDateTime({ date: "2026-05-14", time: "18:00" }, TZ);
    const target: LocalDateTime = { date: "2026-05-14", time: "19:30" };

    const expiry = computeRequestExpiry(target, TZ, rules, requestedAt);

    expect(expiry.hour).toBe(18);
    expect(expiry.minute).toBe(20);
    // Above all: the expiry must never be before the moment the request was made.
    expect(minutesBetween(requestedAt, expiry)).toBeGreaterThanOrEqual(rules.requestExpiryFloorMinutes);
  });

  it("never produces an expiry before the request was made, for any slot distance", () => {
    const requestedAt = toZonedDateTime({ date: "2026-05-14", time: "19:29" }, TZ);
    const target: LocalDateTime = { date: "2026-05-14", time: "19:30" }; // one minute out

    const expiry = computeRequestExpiry(target, TZ, rules, requestedAt);

    expect(minutesBetween(requestedAt, expiry)).toBeGreaterThanOrEqual(0);
  });
});

describe("isRequestUrgent", () => {
  // A request made well ahead of its slot, so the 90-minute duration (not the
  // floor) governs — a long enough window that "just created" and "close to
  // expiry" are genuinely different moments.
  const requestedAt = toZonedDateTime({ date: "2026-05-14", time: "12:00" }, TZ);
  const target: LocalDateTime = { date: "2026-05-14", time: "19:30" };
  const expiry = computeRequestExpiry(target, TZ, rules, requestedAt); // 12:00 + 90min = 13:30

  it("is not urgent immediately after the request is made", () => {
    expect(isRequestUrgent(expiry, rules, requestedAt)).toBe(false);
  });

  it("becomes urgent inside the urgent threshold", () => {
    // 44 minutes before expiry — within the 45-minute threshold
    const almostThere = expiry.subtract({ minutes: 44 });
    expect(isRequestUrgent(expiry, rules, almostThere)).toBe(true);
  });

  it("is exactly on the boundary at the threshold itself", () => {
    const atThreshold = expiry.subtract({ minutes: rules.urgentThresholdMinutes });
    expect(isRequestUrgent(expiry, rules, atThreshold)).toBe(true);
  });

  it("a tight-slot request (floor applied) is urgent from the moment it is created", () => {
    // The D-11 scenario: only a 20-minute window exists at all, which is
    // itself inside the 45-minute urgent threshold — this request is urgent
    // for its entire life, and the staff tablet should alert immediately.
    const tightRequestedAt = toZonedDateTime({ date: "2026-05-14", time: "18:00" }, TZ);
    const tightExpiry = computeRequestExpiry(target, TZ, rules, tightRequestedAt); // 18:20
    expect(isRequestUrgent(tightExpiry, rules, tightRequestedAt)).toBe(true);
  });
});
