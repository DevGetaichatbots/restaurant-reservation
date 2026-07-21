import type { QueryClient } from "@tanstack/react-query";

import { useRealtimeConnection } from "./react";
import type { ReservationChangedPayload } from "./types";

/**
 * The query-key convention every front-end module reading reservation data
 * should follow, so this one invalidation function stays correct for all
 * three apps without each maintaining its own copy.
 */
export const queryKeys = {
  reservationsList: ["reservations", "list"] as const,
  reservationDetail: (id: string) => ["reservations", "detail", id] as const,
  requestsQueue: ["requests", "queue"] as const,
  availabilityCalendar: ["availability", "calendar"] as const,
  availabilitySlots: ["availability", "slots"] as const,
  availabilityTables: ["availability", "tables"] as const,
};

/**
 * Turns a thin realtime event into cache invalidation — proposal §08's
 * "thin events, not fat ones": the payload is never written into the cache
 * directly, it only marks what might now be stale, and TanStack Query
 * refetches it through the normal authenticated endpoint. That refetch is
 * what re-applies whatever permission and business-rule checks the direct
 * REST call already enforces; trusting the SSE payload itself would bypass
 * both.
 *
 * Deliberately broad rather than precise: every invalidation below matches
 * on the query key's first segment, so e.g. `["reservations", "list", {
 * status: "confirmed" }]` and `["reservations", "detail", id]` both refetch
 * regardless of the event's specifics. A guest booking changes availability,
 * the admin's list, and the request queue all at once — narrowing this to
 * "only the affected date" would save a handful of refetches at the cost of
 * a real risk of an interface quietly going stale.
 */
export function invalidateForReservationEvent(queryClient: QueryClient, _payload: ReservationChangedPayload): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.reservationsList });
  void queryClient.invalidateQueries({ queryKey: queryKeys.requestsQueue });
  void queryClient.invalidateQueries({ queryKey: queryKeys.availabilityCalendar });
  void queryClient.invalidateQueries({ queryKey: queryKeys.availabilitySlots });
  void queryClient.invalidateQueries({ queryKey: queryKeys.availabilityTables });
}

/**
 * The one call each app makes, near its root: opens the live connection and
 * keeps TanStack Query's cache honest for as long as the component tree is
 * mounted.
 *
 * @example
 * function App() {
 *   const queryClient = useQueryClient();
 *   useLiveReservations(`${API_URL}/events`, queryClient);
 *   // ...
 * }
 */
export function useLiveReservations(url: string, queryClient: QueryClient): void {
  useRealtimeConnection(url, (payload) => invalidateForReservationEvent(queryClient, payload));
}
