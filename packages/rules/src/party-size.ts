import { fail, pass, type ReservationRulesConfig, type RuleResult } from "./types.js";

/**
 * Rule — max guests per booking, plus the table-capacity check the brief asks
 * for alongside it ("party size cannot exceed table seats").
 *
 * `tableSeats` is optional: a request that has not been assigned a table yet
 * (proposal §07) has nothing to check party size against until an admin
 * assigns one — at which point this same function runs again with the seat
 * count filled in.
 */
export function checkPartySize(
  partySize: number,
  rules: ReservationRulesConfig,
  tableSeats?: number,
): RuleResult {
  if (partySize <= 0) {
    return fail("party_size", "Party size must be at least 1.");
  }

  if (partySize > rules.maxGuestsPerBooking) {
    return fail(
      "party_size",
      `Bookings are limited to ${rules.maxGuestsPerBooking} guests. For larger groups, please call the restaurant.`,
    );
  }

  if (tableSeats !== undefined && partySize > tableSeats) {
    return fail("party_size", `This table seats ${tableSeats} — please choose a table that fits your group.`);
  }

  return pass();
}
