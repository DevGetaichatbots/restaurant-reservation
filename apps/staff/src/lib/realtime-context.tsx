import type { ConnectionStatus, ReservationChangedPayload } from "@rms/realtime";
import { invalidateForReservationEvent, useRealtimeConnection } from "@rms/realtime";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { API_URL } from "./api";
import { playAlertSound } from "./sound";

/** Distinct from the raw `ConnectionStatus`: the very first handshake on
 *  app launch is "connecting" too, but there is nothing to call a
 *  *reconnect* yet — the banner (E-15) only means something once a
 *  connection has actually been lost. */
type BannerStatus = "hidden" | "reconnecting";

interface RealtimeContextValue {
  bannerStatus: BannerStatus;
  isLive: boolean;
  lastSyncedAt: Date | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  bannerStatus: "hidden",
  isLive: false,
  lastSyncedAt: null,
});

/**
 * One live connection for the whole app, shared via context — mirrors
 * @rms/realtime's own "one EventSource per app root" convention, just with
 * the status also threaded down to whichever component renders the
 * "Reconnecting…" banner or the Settings page's connection readout,
 * instead of only driving cache invalidation the way booking/admin use it.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [bannerStatus, setBannerStatus] = useState<BannerStatus>("hidden");
  const [isLive, setIsLive] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const hasConnectedOnce = useRef(false);

  const onEvent = useCallback(
    (payload: ReservationChangedPayload) => {
      invalidateForReservationEvent(queryClient, payload);
      setLastSyncedAt(new Date());
      // A brand new booking is the one event worth interrupting the floor
      // for — a status change (someone else accepted a request, a table
      // freed up) is reflected the moment the relevant screen refetches,
      // with no alert needed.
      if (payload.kind === "created") playAlertSound();
    },
    [queryClient],
  );

  const onStatusChange = useCallback((status: ConnectionStatus) => {
    if (status === "open") {
      hasConnectedOnce.current = true;
      setBannerStatus("hidden");
      setIsLive(true);
      setLastSyncedAt(new Date());
    } else if (status === "connecting") {
      setIsLive(false);
      if (hasConnectedOnce.current) setBannerStatus("reconnecting");
    }
  }, []);

  useRealtimeConnection(`${API_URL}/events`, onEvent, onStatusChange);

  return (
    <RealtimeContext.Provider value={{ bannerStatus, isLive, lastSyncedAt }}>{children}</RealtimeContext.Provider>
  );
}

export function useConnectionBannerStatus(): BannerStatus {
  return useContext(RealtimeContext).bannerStatus;
}

export function useConnectionInfo(): { isLive: boolean; lastSyncedAt: Date | null } {
  const { isLive, lastSyncedAt } = useContext(RealtimeContext);
  return { isLive, lastSyncedAt };
}
