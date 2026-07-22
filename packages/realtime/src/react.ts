import { useEffect, useRef } from "react";

import { RealtimeClient, type ConnectionStatus, type ReservationEventListener } from "./client";

/**
 * Subscribes a component to the live event stream for its lifetime.
 *
 * One `RealtimeClient` — and therefore one `EventSource` connection — per
 * mounted consumer of this hook. In practice each app calls it once, near
 * its root, and fans the events out internally (see
 * `useReservationEvents`/the query-invalidation pattern below) rather than
 * every component opening its own connection.
 *
 * Guarded for SSR: `EventSource` does not exist on the server, and the
 * guest booking page is server-rendered (proposal §03's stack table) —
 * this hook is a no-op until it runs in the browser.
 *
 * `onStatusChange` is optional — most callers only care about the events
 * themselves; the staff tablet's "Reconnecting…" banner (E-15) is what
 * actually needs it.
 */
export function useRealtimeConnection(
  url: string,
  onEvent: ReservationEventListener,
  onStatusChange?: (status: ConnectionStatus) => void,
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const client = new RealtimeClient(url);
    const unsubscribe = client.on((payload) => onEventRef.current(payload));
    const unsubscribeStatus = client.onStatusChange((status) => onStatusChangeRef.current?.(status));
    client.connect();

    return () => {
      unsubscribe();
      unsubscribeStatus();
      client.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEvent/onStatusChange
    // are read through refs specifically so a new inline callback each
    // render doesn't reconnect the stream.
  }, [url]);
}
