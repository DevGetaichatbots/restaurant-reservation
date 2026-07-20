import type { BookingMode } from "./types.js";

/**
 * The decision at the centre of proposal §07: given the restaurant's booking
 * mode and whether a table is actually free, what happens to this booking?
 *
 * This is the function that replaces the brief's single `auto_confirm`
 * boolean. It is pure and synchronous — every input is something the caller
 * already knows (a table lookup, a slot's overflow counts), so the decision
 * itself never touches the database and is trivial to test at every boundary.
 */
export interface BookingOutcomeInput {
  mode: BookingMode;
  tableAvailable: boolean;
  partySize: number;

  /** From reservation_rules. */
  overflowPartiesPerSlot: number;
  overflowCoversPerSlot: number;
  allowWaitlist: boolean;

  /** Already-accepted overflow bookings for this exact date + slot, not
   *  counting the one being decided now. */
  overflowPartiesAccepted: number;
  overflowCoversAccepted: number;
}

export type BookingOutcome =
  | { status: "confirmed" }
  | { status: "requested"; reason: "no_table" | "manual_mode" }
  | { status: "waitlisted" }
  /** No table, no room left in the overflow allowance, and waitlisting is
   *  switched off. Only reachable in `automatic` mode by default — the
   *  recommended configuration (auto_then_manual + waitlist on, per D-09 and
   *  D-12) never produces this outcome, which is what "no guest turned away"
   *  actually rests on. */
  | { status: "unavailable" };

export function decideBookingOutcome(input: BookingOutcomeInput): BookingOutcome {
  const { mode, tableAvailable, partySize } = input;

  // A free table under automatic or auto-then-manual needs no human at all —
  // this is the "easy" case the whole design exists to keep off a person's
  // plate.
  if (tableAvailable && mode !== "manual") {
    return { status: "confirmed" };
  }

  // Manual mode reviews every booking, table or not — the owner asked for
  // eyes on everything, including the easy cases, on nights that call for it.
  if (tableAvailable && mode === "manual") {
    return { status: "requested", reason: "manual_mode" };
  }

  // No table is free from this point on.

  if (mode === "automatic") {
    // Automatic never asks a guest to wait past the physical table grid —
    // that flexibility is precisely what auto_then_manual and manual exist
    // for. This is the one mode where a full slot is genuinely just full, and
    // it is an admin's deliberate choice to run it, not the default.
    return { status: "unavailable" };
  }

  const partiesWithinAllowance = input.overflowPartiesAccepted < input.overflowPartiesPerSlot;
  const coversWithinAllowance =
    input.overflowCoversAccepted + partySize <= input.overflowCoversPerSlot;

  if (partiesWithinAllowance && coversWithinAllowance) {
    return { status: "requested", reason: "no_table" };
  }

  if (input.allowWaitlist) {
    return { status: "waitlisted" };
  }

  return { status: "unavailable" };
}
