"use client";

import { Button, Chip } from "@rms/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Temporal } from "temporal-polyfill";

import { useSlots } from "../../../../lib/hooks/use-availability";
import { useBookingStore } from "../../../../lib/booking-store";

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

export default function SelectTimePage() {
  const router = useRouter();
  const { date, time, partySize, setTime } = useBookingStore();

  useEffect(() => {
    if (!date) router.replace("/book/date");
  }, [date, router]);

  const { data: slots, isLoading } = useSlots(date, partySize);

  if (!date) return null;

  const requestSlots = (slots ?? []).filter((s) => s.status === "on_request");

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">What time works?</h1>
        <p className="mt-1 text-sm text-ink-2">
          {formatDate(date)} · {partySize} {partySize === 1 ? "guest" : "guests"}
        </p>
      </div>

      <div className="rounded-lg border border-rule bg-paper-2 p-4 shadow-sm sm:p-5">
        {isLoading ? (
          <SkeletonChips />
        ) : !slots || slots.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-2">
            No times are available on this date. Please choose another date.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {slots.map((slot) => {
              const isSelected = slot.startTime === time;
              return (
                <Chip
                  key={slot.startTime}
                  state={isSelected ? "selected" : slot.status === "on_request" ? "onRequest" : slot.status === "unavailable" ? "unavailable" : "available"}
                  onClick={() => setTime(slot.startTime)}
                >
                  {formatTime(slot.startTime)}
                  {slot.status === "on_request" && !isSelected && (
                    <span className="text-[0.65rem] font-normal opacity-75">· on request</span>
                  )}
                </Chip>
              );
            })}
          </div>
        )}

        {requestSlots.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs text-ink-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            Times marked <strong className="font-semibold">on request</strong> are fully booked, but the
            restaurant can often still fit you in — we&rsquo;ll confirm shortly after you submit.
          </p>
        )}
      </div>

      {time && (
        <p className="animate-fade-up text-center text-sm text-ink-2">
          Selected time: <span className="font-semibold text-ink">{formatTime(time)}</span>
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="lg" onClick={() => router.push("/book/date")}>
          Back
        </Button>
        <Button size="lg" fullWidth disabled={!time} onClick={() => router.push("/book/table")}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function SkeletonChips() {
  return (
    <div className="flex flex-wrap gap-2.5" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-11 w-24 animate-pulse rounded-full bg-paper-3" />
      ))}
    </div>
  );
}
