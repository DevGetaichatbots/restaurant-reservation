import { describe, expect, it } from "vitest";

import { checkContactInformation } from "../contact-info.js";
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

describe("checkContactInformation", () => {
  it("rejects neither phone nor email when required", () => {
    expect(checkContactInformation({}, rules)).toMatchObject({
      ok: false,
      rule: "contact_information",
    });
  });

  it("rejects whitespace-only fields", () => {
    expect(checkContactInformation({ phone: "   ", email: "" }, rules)).toMatchObject({
      ok: false,
    });
  });

  it("allows phone alone", () => {
    expect(checkContactInformation({ phone: "+92 300 1234567" }, rules).ok).toBe(true);
  });

  it("allows email alone", () => {
    expect(checkContactInformation({ email: "guest@example.com" }, rules).ok).toBe(true);
  });

  it("allows both", () => {
    expect(
      checkContactInformation({ phone: "+92 300 1234567", email: "guest@example.com" }, rules).ok,
    ).toBe(true);
  });

  it("allows neither when the rule does not require it", () => {
    expect(checkContactInformation({}, { ...rules, requireContactInformation: false }).ok).toBe(
      true,
    );
  });
});
