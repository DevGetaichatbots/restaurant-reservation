import { Card, Spinner } from "@rms/ui";
import { useMemo } from "react";

import { ReservationCard } from "../components/ReservationCard";
import { useReservations } from "../hooks/use-reservations";
import { todayIso } from "../lib/date";

/** Who is in the room right now — the turn-time view (proposal §11). */
export function SeatedPage() {
  const reservationsQuery = useReservations({ date: todayIso(), status: "seated" });

  const rows = useMemo(
    () => (reservationsQuery.data ?? []).sort((a, b) => a.reservationTime.localeCompare(b.reservationTime)),
    [reservationsQuery.data],
  );

  return (
    <div>
      {reservationsQuery.isLoading ? (
        <Spinner className="mx-auto mt-12 text-ink-3" />
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-base text-ink-3">Nobody currently seated.</Card>
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
