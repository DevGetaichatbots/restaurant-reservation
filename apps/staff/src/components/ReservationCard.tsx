import type { ReservationAction, ReservationDto } from "@rms/contracts";
import { Button, StatusPill } from "@rms/ui";
import { MoreHorizontal, Phone, Users } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Dialog } from "./ui/Dialog";
import { usePerformReservationAction } from "../hooks/use-reservations";
import { formatSource } from "../lib/format";
import { formatTime } from "../lib/date";

/** A booking is "overdue" once this many minutes have passed its start time
 *  without being seated — the amber highlight from proposal §11's /today
 *  spec ("row turns amber after a grace period"). */
const OVERDUE_GRACE_MINUTES = 15;

function isOverdue(reservation: ReservationDto): boolean {
  if (!["confirmed", "overflow"].includes(reservation.status)) return false;
  const start = new Date(`${reservation.reservationDate}T${reservation.reservationTime}`);
  const graceElapsed = Date.now() - start.getTime() > OVERDUE_GRACE_MINUTES * 60_000;
  return graceElapsed;
}

function MoreActionsDialog({
  reservation,
  open,
  onOpenChange,
}: {
  reservation: ReservationDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const performAction = usePerformReservationAction();
  const [confirming, setConfirming] = useState<ReservationAction | null>(null);

  const allOptions: { action: ReservationAction; label: string; available: boolean }[] = [
    { action: "no_show", label: "Mark as no-show", available: ["confirmed", "overflow"].includes(reservation.status) },
    {
      action: "cancel",
      label: "Cancel reservation",
      available: !["completed", "cancelled", "declined", "expired", "no_show"].includes(reservation.status),
    },
  ];
  const options = allOptions.filter((o) => o.available);

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={onOpenChange} title={reservation.guestName} description="More actions">
        <div className="space-y-2">
          {options.length === 0 && <p className="text-base text-ink-3">Nothing else to do here.</p>}
          {options.map((o) => (
            <button
              key={o.action}
              type="button"
              onClick={() => setConfirming(o.action)}
              className="flex h-14 w-full items-center rounded-lg border border-rule px-4 text-left text-base font-medium text-danger transition-colors hover:bg-danger-subtle"
            >
              {o.label}
            </button>
          ))}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={confirming === "cancel" ? "Cancel this reservation?" : "Mark as no-show?"}
        description={`${reservation.guestName} · ${formatTime(reservation.reservationTime)} · ${reservation.partySize} guests`}
        confirmLabel={confirming === "cancel" ? "Cancel reservation" : "Mark no-show"}
        variant="danger"
        loading={performAction.isPending}
        onConfirm={() => {
          if (!confirming) return;
          performAction.mutate(
            { id: reservation.id, action: confirming },
            { onSuccess: () => { setConfirming(null); onOpenChange(false); } },
          );
        }}
      />
    </>
  );
}

export function ReservationCard({
  reservation,
  onConfirmRequest,
}: {
  reservation: ReservationDto;
  /** Only relevant for requested/waitlisted rows — Today's list reuses the
   *  Requests queue's accept flow rather than duplicating it. */
  onConfirmRequest?: (reservation: ReservationDto) => void;
}) {
  const performAction = usePerformReservationAction();
  const [moreOpen, setMoreOpen] = useState(false);
  const overdue = isOverdue(reservation);

  return (
    <div
      className={cardClassName(overdue)}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="w-20 shrink-0 text-center">
          <p className="text-lg font-semibold tabular-nums text-ink">{formatTime(reservation.reservationTime)}</p>
          {overdue && <p className="text-xs font-semibold text-warning">Overdue</p>}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-ink">{reservation.guestName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Users size={14} /> {reservation.partySize}
            </span>
            {reservation.guestPhone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={14} /> {reservation.guestPhone}
              </span>
            )}
            <span>{reservation.tableName ?? "No table yet"}</span>
            <span className="hidden sm:inline">{formatSource(reservation.source)}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusPill status={reservation.status} />

        {(reservation.status === "requested" || reservation.status === "waitlisted") && onConfirmRequest && (
          <Button size="lg" onClick={() => onConfirmRequest(reservation)}>
            Confirm
          </Button>
        )}
        {(reservation.status === "confirmed" || reservation.status === "overflow") && (
          <Button
            size="lg"
            loading={performAction.isPending}
            onClick={() => performAction.mutate({ id: reservation.id, action: "seat" })}
          >
            Seat
          </Button>
        )}
        {reservation.status === "seated" && (
          <Button
            size="lg"
            loading={performAction.isPending}
            onClick={() => performAction.mutate({ id: reservation.id, action: "complete" })}
          >
            Complete
          </Button>
        )}

        <button
          type="button"
          aria-label="More actions"
          onClick={() => setMoreOpen(true)}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink"
        >
          <MoreHorizontal size={22} />
        </button>
      </div>

      <MoreActionsDialog reservation={reservation} open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}

function cardClassName(overdue: boolean): string {
  const base =
    "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition-colors";
  return overdue ? `${base} border-warning bg-warning-subtle` : `${base} border-rule bg-paper`;
}
