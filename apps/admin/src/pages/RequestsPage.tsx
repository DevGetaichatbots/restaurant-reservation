import type { RequestQueueItem } from "@rms/contracts";
import { Button, Card, Spinner, StatusPill } from "@rms/ui";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useState } from "react";

import { Dialog } from "../components/ui/Dialog";
import { PageHeader } from "../components/ui/PageHeader";
import { apiClient } from "../lib/api";
import { formatTime } from "../lib/date";
import { useAcceptRequest, useAcceptRequestOverflow, useDeclineRequest, useRequests } from "../hooks/use-requests";

function CapacityMeter({ item }: { item: RequestQueueItem }) {
  const { capacity } = item;
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-3">
      <span>
        Tables: {capacity.tablesOccupied}/{capacity.tablesTotal} occupied
      </span>
      <span>
        Overflow: {capacity.overflowPartiesAccepted}/{capacity.overflowPartiesAllowed} parties
      </span>
      <span>Covers: {capacity.overflowCoversAccepted}/{capacity.overflowCoversAllowed}</span>
      <span>Waiting same slot: {capacity.requestsWaitingSameSlot}</span>
    </div>
  );
}

function AssignTableDialog({ item, onClose }: { item: RequestQueueItem | null; onClose: () => void }) {
  const acceptRequest = useAcceptRequest();
  const { reservation } = item ?? {};

  const tablesQuery = useQuery({
    queryKey: ["availability", "tables", reservation?.reservationDate, reservation?.reservationTime, reservation?.partySize],
    queryFn: () =>
      apiClient.getTables(reservation!.reservationDate, reservation!.reservationTime, reservation!.partySize),
    enabled: Boolean(reservation),
  });

  if (!item || !reservation) return null;

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Assign a table — ${reservation.guestName}`}
      description={`${formatTime(reservation.reservationTime)} · ${reservation.partySize} guests`}
    >
      {tablesQuery.isLoading ? (
        <Spinner className="mx-auto text-ink-3" />
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {(tablesQuery.data ?? []).map((table) => (
            <button
              key={table.id}
              type="button"
              disabled={table.status !== "available" || acceptRequest.isPending}
              onClick={() =>
                acceptRequest.mutate({ id: reservation.id, body: { tableId: table.id } }, { onSuccess: onClose })
              }
              className="flex w-full items-center justify-between rounded-md border border-rule px-3 py-2.5 text-left text-sm transition-colors enabled:hover:border-primary enabled:hover:bg-primary/5 disabled:opacity-40"
            >
              <span className="font-medium text-ink">
                {table.tableName} · {table.seats} seats · {table.location}
              </span>
              <span className="text-xs uppercase text-ink-3">{table.status.replace("_", " ")}</span>
            </button>
          ))}
          {(tablesQuery.data ?? []).length === 0 && <p className="text-sm text-ink-3">No tables configured.</p>}
        </div>
      )}
    </Dialog>
  );
}

function RequestCard({ item, onAssign }: { item: RequestQueueItem; onAssign: () => void }) {
  const acceptRequest = useAcceptRequest();
  const acceptOverflow = useAcceptRequestOverflow();
  const decline = useDeclineRequest();
  const { reservation } = item;
  const isPending = acceptRequest.isPending || acceptOverflow.isPending || decline.isPending;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink">{reservation.guestName}</p>
            {item.isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-semibold text-danger">
                <Clock size={12} /> Urgent
              </span>
            )}
          </div>
          <p className="text-sm text-ink-3">
            {formatTime(reservation.reservationTime)} · {reservation.partySize} guests · waiting {item.waitingMinutes}m
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {item.reason === "no_table" ? "No table free at this time" : "Manual mode — awaiting approval"}
            {reservation.tableName && item.reason === "manual_mode" ? ` (holding ${reservation.tableName})` : ""}
          </p>
        </div>
        <StatusPill status={reservation.status} />
      </div>

      <CapacityMeter item={item} />

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={isPending} onClick={() => decline.mutate(reservation.id)}>
          Decline
        </Button>
        <Button
          variant="secondary"
          disabled={isPending}
          loading={acceptOverflow.isPending}
          onClick={() => acceptOverflow.mutate(reservation.id)}
        >
          Accept as overflow
        </Button>
        {reservation.tableId ? (
          <Button loading={acceptRequest.isPending} disabled={isPending} onClick={() => acceptRequest.mutate({ id: reservation.id, body: {} })}>
            Confirm held table
          </Button>
        ) : (
          <Button disabled={isPending} onClick={onAssign}>
            Assign table
          </Button>
        )}
      </div>
    </Card>
  );
}

export function RequestsPage() {
  const requestsQuery = useRequests();
  const [assigning, setAssigning] = useState<RequestQueueItem | null>(null);

  return (
    <div>
      <PageHeader
        title="Request queue"
        description="Bookings waiting on a human decision — oldest first. Nothing here is turned away automatically."
      />

      {requestsQuery.isLoading ? (
        <Spinner className="mx-auto mt-8 text-ink-3" />
      ) : (requestsQuery.data ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-3">No requests waiting on a decision.</Card>
      ) : (
        <div className="space-y-3">
          {(requestsQuery.data ?? []).map((item) => (
            <RequestCard key={item.reservation.id} item={item} onAssign={() => setAssigning(item)} />
          ))}
        </div>
      )}

      <AssignTableDialog item={assigning} onClose={() => setAssigning(null)} />
    </div>
  );
}
