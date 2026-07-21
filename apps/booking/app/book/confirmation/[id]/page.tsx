import { ApiClientError } from "@rms/api-client";
import { Button, StatusPill } from "@rms/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "../../../../components/ThemeToggle";
import { ResetBookingStore } from "../../../../components/ResetBookingStore";
import { apiClient } from "../../../../lib/api";

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

const HEADLINES: Record<string, { title: string; body: string }> = {
  confirmed: { title: "Your reservation is confirmed!", body: "We look forward to seeing you." },
  overflow: {
    title: "Your reservation is confirmed!",
    body: "The restaurant will have a table ready — no further action needed.",
  },
  requested: {
    title: "Request received",
    body: "The restaurant will confirm shortly. You'll be notified as soon as they respond.",
  },
  waitlisted: {
    title: "You're on the waitlist",
    body: "We'll let you know the moment a table opens up for this time.",
  },
};

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const reservation = await apiClient.getReservation(id).catch((error) => {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  });

  const headline = HEADLINES[reservation.status] ?? {
    title: "Reservation recorded",
    body: "We'll be in touch with any updates.",
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <ResetBookingStore />

      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-8 pt-6 sm:px-6 sm:pt-10">
        <div className="animate-scale-in text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-subtle text-success">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12.5 9.5 17 19 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-4 font-display text-2xl font-medium text-ink">{headline.title}</h1>
          <p className="mt-1.5 text-sm text-ink-2">{headline.body}</p>
        </div>

        <div className="animate-fade-up mt-7 rounded-lg border border-rule bg-paper-2 p-5 shadow-md sm:p-6">
          <div className="flex items-center justify-between border-b border-rule pb-4">
            <span className="text-sm font-medium text-ink-2">Reservation</span>
            <StatusPill status={reservation.status} />
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Date" value={formatDate(reservation.reservationDate)} />
            <Row label="Time" value={formatTime(reservation.reservationTime)} />
            <Row
              label="Table"
              value={
                reservation.tableName
                  ? `${reservation.tableName} (${reservation.partySize} guests)`
                  : `To be arranged (${reservation.partySize} guests)`
              }
            />
            <Row label="Name" value={reservation.guestName} />
            <Row label="Contact" value={reservation.guestPhone ?? reservation.guestEmail ?? "—"} />
          </dl>
        </div>

        <div className="mt-6 space-y-2 text-center">
          <Link href={`/reservation/${reservation.id}`} className="text-sm font-medium text-secondary underline underline-offset-2">
            Manage this reservation
          </Link>
        </div>

        <Link href="/" className="mt-6">
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
