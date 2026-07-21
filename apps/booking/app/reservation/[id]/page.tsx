"use client";

import { ApiClientError } from "@rms/api-client";
import { Button, StatusPill } from "@rms/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";

import { ThemeToggle } from "../../../components/ThemeToggle";
import { apiClient } from "../../../lib/api";

const TERMINAL = ["cancelled", "completed", "declined", "expired", "no_show"];

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d));
  return `${WEEKDAY_NAMES[dt.getUTCDay()]}, ${d} ${MONTH_NAMES[m! - 1]} ${y}`;
}
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour12 = h! % 12 === 0 ? 12 : h! % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function ManageReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: reservation, isLoading } = useQuery({
    queryKey: ["reservations", "detail", id],
    queryFn: () => apiClient.getReservation(id),
  });

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await apiClient.cancelReservation(id);
      await queryClient.invalidateQueries({ queryKey: ["reservations", "detail", id] });
      setConfirmingCancel(false);
    } catch (error) {
      setCancelError(error instanceof ApiClientError ? error.message : "Couldn't cancel — please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-8 pt-6 sm:px-6 sm:pt-10">
        <h1 className="font-display text-2xl font-medium text-ink">Your reservation</h1>

        {isLoading && (
          <div className="mt-6 h-64 animate-pulse rounded-lg bg-paper-3" aria-hidden="true" />
        )}

        {!isLoading && !reservation && (
          <p className="mt-4 text-sm text-danger">We couldn&rsquo;t find that reservation.</p>
        )}

        {reservation && (
          <>
            <div className="animate-fade-up mt-6 rounded-lg border border-rule bg-paper-2 p-5 shadow-md sm:p-6">
              <div className="flex items-center justify-between border-b border-rule pb-4">
                <span className="text-sm font-medium text-ink-2">{reservation.guestName}</span>
                <StatusPill status={reservation.status} />
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Date" value={formatDate(reservation.reservationDate)} />
                <Row label="Time" value={formatTime(reservation.reservationTime)} />
                <Row label="Guests" value={String(reservation.partySize)} />
                <Row label="Table" value={reservation.tableName ?? "To be arranged"} />
              </dl>
            </div>

            {!TERMINAL.includes(reservation.status) && (
              <div className="mt-6">
                {!confirmingCancel ? (
                  <Button variant="danger" size="lg" fullWidth onClick={() => setConfirmingCancel(true)}>
                    Cancel reservation
                  </Button>
                ) : (
                  <div className="animate-fade-up space-y-3 rounded-lg border border-danger/30 bg-danger-subtle p-4">
                    <p className="text-sm font-medium text-ink">
                      Cancel your reservation for {formatDate(reservation.reservationDate)} at{" "}
                      {formatTime(reservation.reservationTime)}?
                    </p>
                    {cancelError && <p className="text-sm text-danger">{cancelError}</p>}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
                        Keep it
                      </Button>
                      <Button variant="danger" size="sm" loading={cancelling} onClick={handleCancel}>
                        Yes, cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {TERMINAL.includes(reservation.status) && (
              <p className="mt-4 text-center text-sm text-ink-2">This reservation is {reservation.status.replace("_", "-")}.</p>
            )}
          </>
        )}

        <Link href="/" className="mt-8">
          <Button variant="ghost" size="lg" fullWidth>
            Back to Home
          </Button>
        </Link>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
