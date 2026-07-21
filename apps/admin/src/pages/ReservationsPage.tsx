import type { ReservationAction, ReservationDto, ReservationStatus } from "@rms/contracts";
import { Button, StatusPill } from "@rms/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable } from "../components/ui/DataTable";
import { Dialog } from "../components/ui/Dialog";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { usePerformReservationAction, useReservations } from "../hooks/use-reservations";
import { formatDateLong, formatTime, todayIso } from "../lib/date";
import { formatSource } from "../lib/format";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "requested", label: "Requested" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "overflow", label: "Overflow" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "no_show", label: "No-show" },
];

const NEXT_ACTIONS: Record<string, { action: ReservationAction; label: string; variant: "primary" | "danger" }[]> = {
  confirmed: [
    { action: "seat", label: "Seat", variant: "primary" },
    { action: "no_show", label: "No-show", variant: "danger" },
    { action: "cancel", label: "Cancel", variant: "danger" },
  ],
  overflow: [
    { action: "seat", label: "Seat", variant: "primary" },
    { action: "no_show", label: "No-show", variant: "danger" },
    { action: "cancel", label: "Cancel", variant: "danger" },
  ],
  seated: [{ action: "complete", label: "Complete", variant: "primary" }],
  requested: [{ action: "cancel", label: "Cancel", variant: "danger" }],
  waitlisted: [{ action: "cancel", label: "Cancel", variant: "danger" }],
};

function DetailDialog({ reservation, onClose }: { reservation: ReservationDto | null; onClose: () => void }) {
  const performAction = usePerformReservationAction();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!reservation) return null;
  const actions = NEXT_ACTIONS[reservation.status] ?? [];

  function run(action: ReservationAction) {
    if (!reservation) return;
    if (action === "cancel") {
      setConfirmCancel(true);
      return;
    }
    performAction.mutate({ id: reservation.id, action });
  }

  return (
    <>
      <Dialog open={reservation !== null} onOpenChange={(open) => !open && onClose()} title={reservation.guestName}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-3">Status</span>
            <StatusPill status={reservation.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Date &amp; time</span>
            <span className="text-ink">
              {formatDateLong(reservation.reservationDate)} at {formatTime(reservation.reservationTime)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Party size</span>
            <span className="text-ink">{reservation.partySize}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-3">Table</span>
            <span className="text-ink">{reservation.tableName ?? "Not yet assigned"}</span>
          </div>
          {reservation.guestPhone && (
            <div className="flex justify-between">
              <span className="text-ink-3">Phone</span>
              <span className="text-ink">{reservation.guestPhone}</span>
            </div>
          )}
          {reservation.guestEmail && (
            <div className="flex justify-between">
              <span className="text-ink-3">Email</span>
              <span className="text-ink">{reservation.guestEmail}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-ink-3">Source</span>
            <span className="text-ink">{formatSource(reservation.source)}</span>
          </div>
          {reservation.notes && (
            <div>
              <span className="text-ink-3">Notes</span>
              <p className="mt-1 rounded-md bg-paper-2 p-2 text-ink">{reservation.notes}</p>
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {actions.map(({ action, label, variant }) => (
              <Button key={action} variant={variant} loading={performAction.isPending} onClick={() => run(action)}>
                {label}
              </Button>
            ))}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this reservation?"
        description={`${reservation.guestName}'s booking will be cancelled. This can't be undone.`}
        confirmLabel="Cancel reservation"
        variant="danger"
        loading={performAction.isPending}
        onConfirm={() =>
          performAction.mutate(
            { id: reservation.id, action: "cancel" },
            { onSuccess: () => { setConfirmCancel(false); onClose(); } },
          )
        }
      />
    </>
  );
}

export function ReservationsPage() {
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reservationsQuery = useReservations({
    date: date || undefined,
    status: status === "all" ? undefined : (status as ReservationStatus),
    search: search || undefined,
  });

  // Derived from the live list rather than captured at click-time, so the
  // open dialog reflects a status change (e.g. after "Seat") the moment the
  // list refetches, instead of showing a stale snapshot with stale actions.
  const selected = reservationsQuery.data?.find((r) => r.id === selectedId) ?? null;

  const columns: ColumnDef<ReservationDto>[] = [
    { accessorKey: "reservationTime", header: "Time", cell: ({ row }) => formatTime(row.original.reservationTime) },
    { accessorKey: "guestName", header: "Guest" },
    { accessorKey: "partySize", header: "Party" },
    { accessorKey: "tableName", header: "Table", cell: ({ row }) => row.original.tableName ?? "—" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill status={row.original.status} /> },
    { accessorKey: "source", header: "Source", cell: ({ row }) => formatSource(row.original.source) },
  ];

  return (
    <div>
      <PageHeader
        title="Reservations"
        description="Every booking on the books — search, filter, and move each one forward."
        actions={
          <>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            <Select value={status} onValueChange={setStatus} options={STATUS_OPTIONS} className="w-44" />
            <Input placeholder="Search guest or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          </>
        }
      />

      <DataTable
        columns={columns}
        data={reservationsQuery.data ?? []}
        isLoading={reservationsQuery.isLoading}
        emptyMessage="No reservations match these filters."
        onRowClick={(row) => setSelectedId(row.id)}
      />

      <DetailDialog reservation={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
