import { Card, Spinner } from "@rms/ui";
import { useMemo } from "react";

import { ReservationCard } from "../components/ReservationCard";
import { useReservations } from "../hooks/use-reservations";
import { todayIso } from "../lib/date";

/** Today's finished covers. Read-only — the API has no transition back from
 *  `completed`, so "reopen if closed by mistake" (proposal §11) would need a
 *  backend change beyond this app's scope; a mis-tap here is caught by
 *  confirming Complete, not undone after. */
export function CompletedPage() {
  const reservationsQuery = useReservations({ date: todayIso(), status: "completed" });

  const rows = useMemo(
    () => (reservationsQuery.data ?? []).sort((a, b) => b.reservationTime.localeCompare(a.reservationTime)),
    [reservationsQuery.data],
  );

  return (
    <div>
      {reservationsQuery.isLoading ? (
        <Spinner className="mx-auto mt-12 text-ink-3" />
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-base text-ink-3">No completed covers yet today.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      )}
    </div>
  );
}
