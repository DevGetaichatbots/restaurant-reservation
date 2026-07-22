import { Card, Spinner } from "@rms/ui";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AssignTableDialog } from "../components/AssignTableDialog";
import { ReservationCard } from "../components/ReservationCard";
import { Input } from "../components/ui/Input";
import { useConfirmRequest } from "../hooks/use-confirm-request";
import { useReservations } from "../hooks/use-reservations";
import { formatDateLong, todayIso } from "../lib/date";

function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TERMINAL = ["cancelled", "declined", "expired", "no_show", "completed"];

export function UpcomingPage() {
  const [search, setSearch] = useState("");
  const { confirm, assigning, closeAssign } = useConfirmRequest();

  // Tomorrow through 30 days out — "all bookings" beyond that is reachable
  // by search, which isn't date-bounded.
  const reservationsQuery = useReservations({
    from: search ? undefined : daysFromToday(1),
    to: search ? undefined : daysFromToday(30),
    search: search || undefined,
  });

  const grouped = useMemo(() => {
    const rows = (reservationsQuery.data ?? [])
      .filter((r) => !TERMINAL.includes(r.status))
      .filter((r) => search || r.reservationDate >= daysFromToday(1))
      .sort((a, b) => (a.reservationDate + a.reservationTime).localeCompare(b.reservationDate + b.reservationTime));

    const byDay = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byDay.get(r.reservationDate) ?? [];
      list.push(r);
      byDay.set(r.reservationDate, list);
    }
    return [...byDay.entries()];
  }, [reservationsQuery.data, search]);

  return (
    <div>
      <div className="mb-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search guest name or phone — find them at the door"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>
      </div>

      {reservationsQuery.isLoading ? (
        <Spinner className="mx-auto mt-12 text-ink-3" />
      ) : grouped.length === 0 ? (
        <Card className="p-10 text-center text-base text-ink-3">
          {search ? "No matching bookings." : "Nothing on the books for the next 30 days."}
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, rows]) => (
            <div key={date}>
              <h2 className="mb-2 font-display text-lg text-ink">
                {date === todayIso() ? "Today" : formatDateLong(date)}
              </h2>
              <div className="space-y-3">
                {rows.map((r) => (
                  <ReservationCard key={r.id} reservation={r} onConfirmRequest={confirm} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignTableDialog reservation={assigning} onClose={closeAssign} />
    </div>
  );
}
