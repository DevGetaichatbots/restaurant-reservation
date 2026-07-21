"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClientError } from "@rms/api-client";
import { Button } from "@rms/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Temporal } from "temporal-polyfill";
import { z } from "zod";

import { useBookingStore } from "../../../../lib/booking-store";
import { apiClient } from "../../../../lib/api";

const detailsSchema = z
  .object({
    guestName: z.string().trim().min(1, "Your name is required."),
    guestPhone: z.string().trim().optional(),
    guestEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
    marketingOptIn: z.boolean(),
  })
  .refine((data) => Boolean(data.guestPhone) || Boolean(data.guestEmail), {
    message: "Please provide a phone number or email so we can confirm your booking.",
    path: ["guestPhone"],
  });

type DetailsForm = z.infer<typeof detailsSchema>;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return `${WEEKDAY_NAMES[d.dayOfWeek % 7]}, ${d.day} ${MONTH_NAMES[d.month - 1]}`;
}
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour12 = h! % 12 === 0 ? 12 : h! % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function GuestDetailsPage() {
  const router = useRouter();
  const store = useBookingStore();
  const { date, time, partySize, tableId, tableName, onRequestPath, guestName, guestPhone, guestEmail, marketingOptIn } = store;

  const [serverError, setServerError] = useState<string | null>(null);
  // Generated once per visit to this page and reused across retries, so a
  // double-tap or a retry after a dropped connection can never create two
  // bookings (proposal §12, E-04).
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (!date || !time) router.replace("/book/date");
  }, [date, time, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { guestName, guestPhone, guestEmail, marketingOptIn },
  });

  async function onSubmit(values: DetailsForm) {
    if (!date || !time) return;
    setServerError(null);
    store.setGuestDetails({
      guestName: values.guestName,
      guestPhone: values.guestPhone ?? "",
      guestEmail: values.guestEmail ?? "",
      marketingOptIn: values.marketingOptIn,
    });

    try {
      const { reservation } = await apiClient.createReservation(
        {
          tableId: tableId ?? undefined,
          guestName: values.guestName,
          guestPhone: values.guestPhone || undefined,
          guestEmail: values.guestEmail || undefined,
          partySize,
          reservationDate: date,
          reservationTime: time,
          marketingOptIn: values.marketingOptIn,
          source: "gmb",
        },
        idempotencyKeyRef.current,
      );

      router.push(`/book/confirmation/${reservation.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.isConflict) {
        setServerError("That table was just taken. Please choose another.");
        return;
      }
      setServerError(
        error instanceof ApiClientError ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (!date || !time) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Almost there</h1>
        <p className="mt-1 text-sm text-ink-2">We just need a few details to confirm your table.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-rule bg-paper-2 p-4 text-sm shadow-sm sm:grid-cols-4">
        <SummaryItem label="Date" value={formatDate(date)} href="/book/date" />
        <SummaryItem label="Time" value={formatTime(time)} href="/book/time" />
        <SummaryItem
          label="Table"
          value={onRequestPath ? "On request" : (tableName ?? "—")}
          href="/book/table"
        />
        <SummaryItem label="Guests" value={`${partySize}`} href="/book/date" />
      </dl>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Full name" error={errors.guestName?.message}>
          <input
            {...register("guestName")}
            type="text"
            autoComplete="name"
            className={inputClass(Boolean(errors.guestName))}
            placeholder="Your name"
          />
        </Field>

        <Field label="Phone number" error={errors.guestPhone?.message} hint="Phone or email — at least one is required.">
          <input
            {...register("guestPhone")}
            type="tel"
            autoComplete="tel"
            className={inputClass(Boolean(errors.guestPhone))}
            placeholder="+92 300 1234567"
          />
        </Field>

        <Field label="Email (optional)" error={errors.guestEmail?.message}>
          <input
            {...register("guestEmail")}
            type="email"
            autoComplete="email"
            className={inputClass(Boolean(errors.guestEmail))}
            placeholder="you@example.com"
          />
        </Field>

        <label className="flex items-start gap-2.5 text-sm text-ink-2">
          <input
            {...register("marketingOptIn")}
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-rule text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          I agree to receive booking updates from the restaurant.
        </label>

        {serverError && (
          <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="button" variant="ghost" size="lg" onClick={() => router.push("/book/table")}>
            Back
          </Button>
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            {onRequestPath ? "Send Request" : "Confirm Reservation"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SummaryItem({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="group text-left">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink group-hover:text-primary">{value}</dd>
    </Link>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-3">{hint}</p>
      ) : null}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return (
    "h-11 w-full rounded-md border bg-paper px-3.5 text-base text-ink placeholder:text-ink-3 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
    (hasError ? "border-danger" : "border-rule")
  );
}
