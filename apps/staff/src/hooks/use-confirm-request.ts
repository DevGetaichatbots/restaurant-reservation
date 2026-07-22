import type { ReservationDto } from "@rms/contracts";
import { useState } from "react";

import { useAcceptRequest } from "./use-requests";

/**
 * "Confirm" on a waiting reservation (proposal §11): one tap if a table is
 * already held (manual-mode-with-a-free-table — mirrors the admin's
 * "Confirm held table"), otherwise opens the table picker. Shared by
 * TodayPage and RequestsPage so both use the exact same rule.
 */
export function useConfirmRequest() {
  const acceptRequest = useAcceptRequest();
  const [assigning, setAssigning] = useState<ReservationDto | null>(null);

  function confirm(reservation: ReservationDto) {
    if (reservation.tableId) {
      acceptRequest.mutate({ id: reservation.id, body: {} });
      return;
    }
    setAssigning(reservation);
  }

  return { confirm, assigning, closeAssign: () => setAssigning(null), isPending: acceptRequest.isPending };
}
