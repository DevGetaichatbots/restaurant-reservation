import type { GuestDto } from "@rms/contracts";
import { Button, StatusPill } from "@rms/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable } from "../components/ui/DataTable";
import { Dialog } from "../components/ui/Dialog";
import { Input, Label, Textarea } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { useDebouncedCallback } from "../hooks/use-debounced-callback";
import { useDeleteGuest, useGuest, useGuests, useUpdateGuest } from "../hooks/use-guests";
import { formatDateLong, formatTime } from "../lib/date";

const OPT_IN_OPTIONS = [
  { value: "all", label: "All customers" },
  { value: "true", label: "Marketing opt-in" },
  { value: "false", label: "Not opted in" },
];

function GuestDetailDialog({ guestId, onClose }: { guestId: string | null; onClose: () => void }) {
  const guestQuery = useGuest(guestId);
  const updateGuest = useUpdateGuest();
  const deleteGuest = useDeleteGuest();
  const [confirmErase, setConfirmErase] = useState(false);

  const guest = guestQuery.data;

  return (
    <>
      <Dialog
        open={guestId !== null}
        onOpenChange={(open) => !open && onClose()}
        title={guest?.name ?? "Customer"}
      >
        {!guest ? (
          <p className="text-sm text-ink-3">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-ink-3">Phone</span>
                <p className="text-ink">{guest.phone ?? "—"}</p>
              </div>
              <div>
                <span className="text-ink-3">Email</span>
                <p className="text-ink">{guest.email ?? "—"}</p>
              </div>
              <div>
                <span className="text-ink-3">Visits</span>
                <p className="text-ink">{guest.visitCount}</p>
              </div>
              <div>
                <span className="text-ink-3">No-shows</span>
                <p className="text-ink">{guest.noShowCount}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5">
              <span className="text-sm font-medium text-ink">Marketing opt-in</span>
              <Switch
                checked={guest.marketingOptIn}
                onCheckedChange={(checked) => updateGuest.mutate({ id: guest.id, body: { marketingOptIn: checked } })}
              />
            </div>

            <div>
              <Label htmlFor="guest-notes">Notes</Label>
              <Textarea
                key={guest.id}
                id="guest-notes"
                rows={3}
                defaultValue={guest.notes ?? ""}
                onBlur={(e) => updateGuest.mutate({ id: guest.id, body: { notes: e.target.value || null } })}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Booking history</p>
              {guest.history.length === 0 ? (
                <p className="text-sm text-ink-3">No bookings yet.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {guest.history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between rounded-md bg-paper-2 px-3 py-2 text-sm">
                      <span className="text-ink">
                        {formatDateLong(h.reservationDate)} · {formatTime(h.reservationTime)} · {h.partySize} guests
                      </span>
                      <StatusPill status={h.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end border-t border-rule pt-4">
              <Button variant="danger" onClick={() => setConfirmErase(true)}>
                Erase customer data
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmErase}
        onOpenChange={setConfirmErase}
        title="Erase this customer's data?"
        description="Name, phone, and notes are permanently removed. Their booking history stays for reporting, but is no longer linked to identifying details. This can't be undone."
        confirmLabel="Erase data"
        variant="danger"
        loading={deleteGuest.isPending}
        onConfirm={() => guest && deleteGuest.mutate(guest.id, { onSuccess: () => { setConfirmErase(false); onClose(); } })}
      />
    </>
  );
}

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [optIn, setOptIn] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const debouncedSetSearch = useDebouncedCallback(setSearch, 300);

  const guestsQuery = useGuests({
    search: search || undefined,
    marketingOptIn: optIn === "all" ? undefined : optIn === "true",
  });

  const columns: ColumnDef<GuestDto>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => row.original.name ?? "—" },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
    { accessorKey: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
    { accessorKey: "visitCount", header: "Visits" },
    { accessorKey: "noShowCount", header: "No-shows" },
    {
      accessorKey: "marketingOptIn",
      header: "Marketing",
      cell: ({ row }) => (row.original.marketingOptIn ? "Opted in" : "—"),
    },
    {
      accessorKey: "lastVisitAt",
      header: "Last visit",
      cell: ({ row }) => (row.original.lastVisitAt ? formatDateLong(row.original.lastVisitAt.slice(0, 10)) : "Never"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Every guest who has ever booked — searchable, with their full history."
        actions={
          <>
            <Input
              placeholder="Search name, phone, or email"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                debouncedSetSearch(e.target.value);
              }}
              className="w-64"
            />
            <Select value={optIn} onValueChange={setOptIn} options={OPT_IN_OPTIONS} className="w-52" />
          </>
        }
      />

      <DataTable
        columns={columns}
        data={guestsQuery.data ?? []}
        isLoading={guestsQuery.isLoading}
        emptyMessage="No customers match this search."
        onRowClick={(row) => setSelected(row.id)}
      />

      <GuestDetailDialog guestId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
