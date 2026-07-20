import { describe, expect, it } from "vitest";

import { decideBookingOutcome, type BookingOutcomeInput } from "../booking-mode.js";

function input(overrides: Partial<BookingOutcomeInput> = {}): BookingOutcomeInput {
  return {
    mode: "auto_then_manual",
    tableAvailable: true,
    partySize: 4,
    overflowPartiesPerSlot: 3,
    overflowCoversPerSlot: 12,
    allowWaitlist: true,
    overflowPartiesAccepted: 0,
    overflowCoversAccepted: 0,
    ...overrides,
  };
}

describe("decideBookingOutcome — automatic mode", () => {
  it("confirms instantly when a table is free", () => {
    const outcome = decideBookingOutcome(input({ mode: "automatic", tableAvailable: true }));
    expect(outcome).toEqual({ status: "confirmed" });
  });

  it("is unavailable — not requested, not waitlisted — when no table is free", () => {
    // This is the one mode that genuinely closes a full slot rather than
    // asking the guest to wait. Automatic never opens the request queue.
    const outcome = decideBookingOutcome(
      input({ mode: "automatic", tableAvailable: false, overflowPartiesAccepted: 0 }),
    );
    expect(outcome).toEqual({ status: "unavailable" });
  });

  it("stays unavailable even with overflow room, because automatic ignores it", () => {
    const outcome = decideBookingOutcome(
      input({
        mode: "automatic",
        tableAvailable: false,
        overflowPartiesPerSlot: 10,
        overflowPartiesAccepted: 0,
      }),
    );
    expect(outcome).toEqual({ status: "unavailable" });
  });
});

describe("decideBookingOutcome — manual mode", () => {
  it("routes to a human even when a table is free", () => {
    const outcome = decideBookingOutcome(input({ mode: "manual", tableAvailable: true }));
    expect(outcome).toEqual({ status: "requested", reason: "manual_mode" });
  });

  it("routes to a human when no table is free, within the overflow allowance", () => {
    const outcome = decideBookingOutcome(
      input({ mode: "manual", tableAvailable: false, overflowPartiesAccepted: 0 }),
    );
    expect(outcome).toEqual({ status: "requested", reason: "no_table" });
  });
});

describe("decideBookingOutcome — auto_then_manual (the default, D-09)", () => {
  it("confirms instantly when a table is free — no human involved", () => {
    const outcome = decideBookingOutcome(
      input({ mode: "auto_then_manual", tableAvailable: true }),
    );
    expect(outcome).toEqual({ status: "confirmed" });
  });

  it("opens a request when no table is free but the overflow allowance has room", () => {
    const outcome = decideBookingOutcome(
      input({
        mode: "auto_then_manual",
        tableAvailable: false,
        overflowPartiesPerSlot: 3,
        overflowPartiesAccepted: 2, // one slot left
      }),
    );
    expect(outcome).toEqual({ status: "requested", reason: "no_table" });
  });

  it("accepts the exact last party the allowance permits", () => {
    const outcome = decideBookingOutcome(
      input({
        mode: "auto_then_manual",
        tableAvailable: false,
        overflowPartiesPerSlot: 3,
        overflowPartiesAccepted: 2, // this would be the 3rd — still within 3
      }),
    );
    expect(outcome.status).toBe("requested");
  });

  it("waitlists the party that would exceed the party allowance", () => {
    const outcome = decideBookingOutcome(
      input({
        mode: "auto_then_manual",
        tableAvailable: false,
        overflowPartiesPerSlot: 3,
        overflowPartiesAccepted: 3, // allowance already full
      }),
    );
    expect(outcome).toEqual({ status: "waitlisted" });
  });

  it("waitlists a party that would exceed the covers allowance even with parties to spare", () => {
    // 3 of 3 covers-allowance already used by a single 10-top; a party of 4
    // would push covers to 14, over the 12-cover ceiling, even though the
    // *party* count (1 of 3) has room.
    const outcome = decideBookingOutcome(
      input({
        mode: "auto_then_manual",
        tableAvailable: false,
        partySize: 4,
        overflowPartiesPerSlot: 3,
        overflowPartiesAccepted: 1,
        overflowCoversPerSlot: 12,
        overflowCoversAccepted: 10,
      }),
    );
    expect(outcome).toEqual({ status: "waitlisted" });
  });

  it("is unavailable — not waitlisted — once the allowance is spent and waitlisting is off", () => {
    const outcome = decideBookingOutcome(
      input({
        mode: "auto_then_manual",
        tableAvailable: false,
        overflowPartiesPerSlot: 3,
        overflowPartiesAccepted: 3,
        allowWaitlist: false,
      }),
    );
    expect(outcome).toEqual({ status: "unavailable" });
  });
});

describe("decideBookingOutcome — the three-guests-one-slot scenario", () => {
  it("confirms the first, requests the rest, in order of the overflow allowance filling up", () => {
    const base = {
      mode: "auto_then_manual" as const,
      partySize: 2,
      overflowPartiesPerSlot: 2,
      overflowCoversPerSlot: 12,
      allowWaitlist: true,
    };

    // Guest 1 gets the last free table.
    const first = decideBookingOutcome({ ...base, tableAvailable: true, overflowPartiesAccepted: 0, overflowCoversAccepted: 0 });
    expect(first).toEqual({ status: "confirmed" });

    // Guest 2 finds no table, but overflow has room (0 of 2 used).
    const second = decideBookingOutcome({ ...base, tableAvailable: false, overflowPartiesAccepted: 0, overflowCoversAccepted: 0 });
    expect(second).toEqual({ status: "requested", reason: "no_table" });

    // Guest 3 finds no table and the allowance now shows guest 2 accepted (1 of 2).
    const third = decideBookingOutcome({ ...base, tableAvailable: false, overflowPartiesAccepted: 1, overflowCoversAccepted: 2 });
    expect(third).toEqual({ status: "requested", reason: "no_table" });

    // Guest 4 arrives after the allowance is now full (2 of 2).
    const fourth = decideBookingOutcome({ ...base, tableAvailable: false, overflowPartiesAccepted: 2, overflowCoversAccepted: 4 });
    expect(fourth).toEqual({ status: "waitlisted" });
  });
});
