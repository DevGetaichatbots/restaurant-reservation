import { fail, pass, type ContactInfo, type ReservationRulesConfig, type RuleResult } from "./types.js";

/**
 * Rule — require contact information.
 *
 * The brief specifies "phone number OR email — at least one required". A
 * blank string counts as absent; a guest leaving the field empty and one never
 * filling it in must fail the same way.
 */
export function checkContactInformation(
  contact: ContactInfo,
  rules: ReservationRulesConfig,
): RuleResult {
  if (!rules.requireContactInformation) return pass();

  const hasPhone = Boolean(contact.phone?.trim());
  const hasEmail = Boolean(contact.email?.trim());

  if (!hasPhone && !hasEmail) {
    return fail("contact_information", "Please provide a phone number or email so we can confirm your booking.");
  }

  return pass();
}
