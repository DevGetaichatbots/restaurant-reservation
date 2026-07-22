import type { ReservationDto } from "@rms/contracts";
import { Spinner } from "@rms/ui";
import { useQuery } from "@tanstack/react-query";

import { Dialog } from "./ui/Dialog";
import { useAcceptRequest, useAcceptRequestOverflow } from "../hooks/use-requests";
import { apiClient } from "../lib/api";
import { formatTime } from "../lib/date";

/** Shared between Today's "Confirm" action and the Requests queue's "Accept
 *  & assign" — proposal §11 asks for the exact same one-tap flow in both
 *  places rather than two implementations. */
export function AssignTableDialog({
  reservation,
  onClose,
}: {
  reservation: ReservationDto | null;
  onClose: () => void;
}) {
  const acceptRequest = useAcceptRequest();
  const acceptOverflow = useAcceptRequestOverflow();

  const tablesQuery = useQuery({
    queryKey: ["availability", "tables", reservation?.reservationDate, reservation?.reservationTime, reservation?.partySize],
    queryFn: () =>
      apiClient.getTables(reservation!.reservationDate, reservation!.reservationTime, reservation!.partySize),
    enabled: reservation !== null,
  });

  if (!reservation) return null;

  const isPending = acceptRequest.isPending || acceptOverflow.isPending;

  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Assign a table — ${reservation.guestName}`}
      description={`${formatTime(reservation.reservationTime)} · ${reservation.partySize} guests`}
    >
      {tablesQuery.isLoading ? (
        <Spinner className="mx-auto text-ink-3" />
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {(tablesQuery.data ?? []).map((table) => (
            <button
              key={table.id}
              type="button"
              disabled={table.status !== "available" || isPending}
              onClick={() =>
                acceptRequest.mutate({ id: reservation.id, body: { tableId: table.id } }, { onSuccess: onClose })
              }
              className="flex min-h-14 w-full items-center justify-between rounded-lg border border-rule px-4 text-left text-base transition-colors enabled:hover:border-primary enabled:hover:bg-primary/5 disabled:opacity-40"
            >
              <span className="font-medium text-ink">
                {table.tableName} · {table.seats} seats · {table.location}
              </span>
              <span className="text-sm uppercase text-ink-3">{table.status.replace("_", " ")}</span>
            </button>
          ))}
          {(tablesQuery.data ?? []).length === 0 && <p className="text-base text-ink-3">No tables configured.</p>}

          <button
            type="button"
            disabled={isPending}
            onClick={() => acceptOverflow.mutate(reservation.id, { onSuccess: onClose })}
            className="flex min-h-14 w-full items-center justify-center rounded-lg border border-dashed border-accent/60 px-4 text-base font-medium text-ink transition-colors hover:bg-accent/10 disabled:opacity-40"
          >
            Accept as overflow — assign a table later
          </button>
        </div>
      )}
    </Dialog>
  );
}
