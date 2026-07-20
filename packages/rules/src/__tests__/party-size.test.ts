import { describe, expect, it } from "vitest";

import { checkPartySize } from "../party-size.js";
import type { ReservationRulesConfig } from "../types.js";

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

describe("checkPartySize", () => {
  it("rejects zero", () => {
    expect(checkPartySize(0, rules)).toMatchObject({ ok: false, rule: "party_size" });
  });

  it("rejects a negative party size", () => {
    expect(checkPartySize(-1, rules)).toMatchObject({ ok: false, rule: "party_size" });
  });

  it("allows one guest", () => {
    expect(checkPartySize(1, rules).ok).toBe(true);
  });

  it("allows exactly the maximum", () => {
    expect(checkPartySize(12, rules).ok).toBe(true);
  });

  it("rejects one over the maximum", () => {
    expect(checkPartySize(13, rules)).toMatchObject({ ok: false, rule: "party_size" });
  });

  it("allows a party that exactly fills the table", () => {
    expect(checkPartySize(4, rules, 4).ok).toBe(true);
  });

  it("rejects a party one larger than the table", () => {
    expect(checkPartySize(5, rules, 4)).toMatchObject({ ok: false, rule: "party_size" });
  });

  it("skips the table check when no table is specified yet", () => {
    // A request with no table assigned — table capacity has nothing to check
    // against until an admin assigns one.
    expect(checkPartySize(20, { ...rules, maxGuestsPerBooking: 30 }).ok).toBe(true);
  });
});
