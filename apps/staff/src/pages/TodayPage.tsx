import { Card, Spinner } from "@rms/ui";
import { RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AssignTableDialog } from "../components/AssignTableDialog";
import { ReservationCard } from "../components/ReservationCard";
import { Input } from "../components/ui/Input";
import { useConfirmRequest } from "../hooks/use-confirm-request";
import { useReservations } from "../hooks/use-reservations";
import { todayIso } from "../lib/date";

const LIVE_TODAY_STATUSES = ["requested", "waitlisted", "confirmed", "overflow", "seated", "completed"];

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-3">{label}</p>
    </Card>
  );
}

export function TodayPage() {
  const today = todayIso();
  const [search, setSearch] = useState("");
  const reservationsQuery = useReservations({ date: today, search: search || undefined });
  const { confirm, assigning, closeAssign } = useConfirmRequest();

  const rows = useMemo(
    () =>
      (reservationsQuery.data ?? [])
        .filter((r) => LIVE_TODAY_STATUSES.includes(r.status))
        .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime)),
    [reservationsQuery.data],
  );

  const counts = useMemo(
    () => ({
      bookings: rows.length,
      seated: rows.filter((r) => r.status === "seated").length,
      upcoming: rows.filter((r) => ["confirmed", "overflow", "requested", "waitlisted"].includes(r.status)).length,
      completed: rows.filter((r) => r.status === "completed").length,
    }),
    [rows],
  );

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Today's Bookings" value={counts.bookings} />
        <SummaryCard label="Seated" value={counts.seated} />
        <SummaryCard label="Upcoming" value={counts.upcoming} />
        <SummaryCard label="Completed" value={counts.completed} />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input
            placeholder="Search guest name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>
        <button
          type="button"
          onClick={() => reservationsQuery.refetch()}
          aria-label="Refresh"
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-rule bg-paper text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
        >
          <RefreshCw size={20} className={reservationsQuery.isFetching ? "animate-spin" : undefined} />
        </button>
      </div>

      {reservationsQuery.isLoading ? (
        <Spinner className="mx-auto mt-12 text-ink-3" />
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-base text-ink-3">Nothing booked for today yet.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReservationCard key={r.id} reservation={r} onConfirmRequest={confirm} />
          ))}
        </div>
      )}

      <AssignTableDialog reservation={assigning} onClose={closeAssign} />
    </div>
  );
}
