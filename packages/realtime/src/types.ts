/**
 * The payload every event on the /events stream carries.
 *
 * Deliberately thin — see apps/api/src/plugins/realtime.ts and migration
 * 0005's trigger comment for why: this is enough to know *what changed*,
 * never enough to act on by itself. A client always follows an event with a
 * normal authenticated fetch rather than trusting the payload as the source
 * of truth, which is what keeps a public, unauthenticated stream safe to run
 * on the guest booking page.
 */
export interface ReservationChangedPayload {
  kind: "created" | "status_changed";
  id: string;
  restaurant_id: string;
  date: string;
  status: string;
  table_id: string | null;
}
