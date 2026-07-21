import { Card, Spinner, StatusPill } from "@rms/ui";
import { CalendarCheck, Inbox, Users, Utensils } from "lucide-react";
import { Link } from "react-router-dom";

import { Select } from "../components/ui/Select";
import { useReservations } from "../hooks/use-reservations";
import { useRequests } from "../hooks/use-requests";
import { useRules, useUpdateRules } from "../hooks/use-rules";
import { useTables } from "../hooks/use-tables";
import { useAuthStore } from "../lib/auth-store";
import { formatDateLong, formatTime, todayIso } from "../lib/date";

const OCCUPYING_OR_LIVE = ["requested", "waitlisted", "confirmed", "overflow", "seated", "completed"];

const BOOKING_MODE_OPTIONS = [
  { value: "auto_then_manual", label: "Auto, then manual (recommended)" },
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm text-ink-3">{label}</p>
          <p className="text-2xl font-semibold text-ink">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-ink-3">{hint}</p>}
    </Card>
  );
}

export function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");
  const today = todayIso();
  const reservationsQuery = useReservations({ date: today });
  const requestsQuery = useRequests();
  // The table roster and reservation rules are both admin-only server-side
  // (proposal: staff see current state via /availability and /reservations,
  // never the grid or rules directly) — gated here too, so the floor view
  // never fires a call it knows will 403.
  const tablesQuery = useTables({ status: "active" }, isAdmin);
  const rulesQuery = useRules(isAdmin);
  const updateRules = useUpdateRules();

  const todaysReservations = (reservationsQuery.data ?? []).filter((r) => OCCUPYING_OR_LIVE.includes(r.status));
  const totalCovers = todaysReservations.reduce((sum, r) => sum + r.partySize, 0);
  const upcoming = todaysReservations
    .filter((r) => ["confirmed", "overflow", "requested", "waitlisted"].includes(r.status))
    .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime))
    .slice(0, 6);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-3">{formatDateLong(today)}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-3">Booking mode</span>
            <Select
              value={rulesQuery.data?.bookingMode ?? ""}
              onValueChange={(value) => updateRules.mutate({ bookingMode: value as "automatic" | "manual" | "auto_then_manual" })}
              options={BOOKING_MODE_OPTIONS}
              className="w-80"
              disabled={!rulesQuery.data || updateRules.isPending}
            />
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Bookings today" value={todaysReservations.length} />
        <StatCard icon={Users} label="Covers today" value={totalCovers} />
        <StatCard
          icon={Inbox}
          label="Pending requests"
          value={requestsQuery.data?.length ?? 0}
          hint={requestsQuery.data?.some((r) => r.isUrgent) ? "Some are urgent" : undefined}
        />
        {isAdmin && <StatCard icon={Utensils} label="Active tables" value={tablesQuery.data?.length ?? 0} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Coming up today</h2>
            <Link to="/reservations" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {reservationsQuery.isLoading ? (
            <Spinner className="mx-auto text-ink-3" />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing left to seat today.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-rule pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.guestName}</p>
                    <p className="text-xs text-ink-3">
                      {formatTime(r.reservationTime)} · {r.partySize} guests
                      {r.tableName ? ` · ${r.tableName}` : ""}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Request queue</h2>
            <Link to="/requests" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {requestsQuery.isLoading ? (
            <Spinner className="mx-auto text-ink-3" />
          ) : (requestsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">No requests waiting on a decision.</p>
          ) : (
            <ul className="space-y-3">
              {(requestsQuery.data ?? []).slice(0, 6).map((item) => (
                <li
                  key={item.reservation.id}
                  className="flex items-center justify-between gap-3 border-b border-rule pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{item.reservation.guestName}</p>
                    <p className="text-xs text-ink-3">
                      {formatTime(item.reservation.reservationTime)} · {item.reservation.partySize} guests · waiting{" "}
                      {item.waitingMinutes}m
                    </p>
                  </div>
                  {item.isUrgent && <StatusPill status="requested" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
