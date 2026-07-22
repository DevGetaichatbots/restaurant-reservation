import type { RequestQueueItem } from "@rms/contracts";
import { Button, Card, Spinner } from "@rms/ui";
import { Clock } from "lucide-react";

import { AssignTableDialog } from "../components/AssignTableDialog";
import { useAcceptRequestOverflow, useDeclineRequest, useRequests } from "../hooks/use-requests";
import { useConfirmRequest } from "../hooks/use-confirm-request";
import { formatTime } from "../lib/date";

function CapacityMeter({ item }: { item: RequestQueueItem }) {
  const { capacity } = item;
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-paper-2 p-3 text-sm text-ink-2 sm:grid-cols-4">
      <span>
        Tables: <strong className="text-ink">{capacity.tablesOccupied}/{capacity.tablesTotal}</strong>
      </span>
      <span>
        Overflow: <strong className="text-ink">{capacity.overflowPartiesAccepted}/{capacity.overflowPartiesAllowed}</strong>
      </span>
      <span>
        Covers: <strong className="text-ink">{capacity.overflowCoversAccepted}/{capacity.overflowCoversAllowed}</strong>
      </span>
      <span>
        Waiting: <strong className="text-ink">{capacity.requestsWaitingSameSlot}</strong>
      </span>
    </div>
  );
}

function RequestCard({ item }: { item: RequestQueueItem }) {
  const { confirm, assigning, closeAssign, isPending: assignPending } = useConfirmRequest();
  const acceptOverflow = useAcceptRequestOverflow();
  const decline = useDeclineRequest();
  const { reservation } = item;
  const isPending = assignPending || acceptOverflow.isPending || decline.isPending;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-medium text-ink">{reservation.guestName}</p>
            {item.isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2.5 py-1 text-xs font-semibold text-danger">
                <Clock size={12} /> Urgent
              </span>
            )}
          </div>
          <p className="text-base text-ink-3">
            {formatTime(reservation.reservationTime)} · {reservation.partySize} guests · waiting {item.waitingMinutes}m
          </p>
          <p className="mt-0.5 text-sm text-ink-3">
            {item.reason === "no_table"
              ? "No table free at this time"
              : `Manual mode — awaiting approval${reservation.tableName ? ` (holding ${reservation.tableName})` : ""}`}
          </p>
        </div>
      </div>

      <CapacityMeter item={item} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="lg" variant="ghost" disabled={isPending} onClick={() => decline.mutate(reservation.id)}>
          Decline
        </Button>
        <Button
          size="lg"
          variant="secondary"
          disabled={isPending}
          loading={acceptOverflow.isPending}
          onClick={() => acceptOverflow.mutate(reservation.id)}
        >
          Accept as overflow
        </Button>
        <Button size="lg" disabled={isPending} loading={assignPending} onClick={() => confirm(reservation)}>
          {reservation.tableId ? "Confirm held table" : "Accept & assign"}
        </Button>
      </div>

      <AssignTableDialog reservation={assigning} onClose={closeAssign} />
    </Card>
  );
}

export function RequestsPage() {
  const requestsQuery = useRequests();

  return (
    <div>
      {requestsQuery.isLoading ? (
        <Spinner className="mx-auto mt-12 text-ink-3" />
      ) : (requestsQuery.data ?? []).length === 0 ? (
        <Card className="p-10 text-center text-base text-ink-3">No requests waiting on a decision.</Card>
      ) : (
        <div className="space-y-3">
          {(requestsQuery.data ?? []).map((item) => (
            <RequestCard key={item.reservation.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
