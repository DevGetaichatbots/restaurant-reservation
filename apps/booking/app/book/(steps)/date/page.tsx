"use client";

import { Button } from "@rms/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Temporal } from "temporal-polyfill";

import { Calendar } from "../../../../components/Calendar";
import { PartySizeSelect } from "../../../../components/PartySizeSelect";
import { useCalendar } from "../../../../lib/hooks/use-availability";
import { useBookingStore } from "../../../../lib/booking-store";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatSelectedDate(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return `${WEEKDAY_NAMES[d.dayOfWeek % 7]}, ${d.day} ${MONTH_NAMES[d.month - 1]} ${d.year}`;
}

export default function SelectDatePage() {
  const router = useRouter();
  const { partySize, date, setPartySize, setDate } = useBookingStore();
  const [month, setMonth] = useState(() =>
    date ? Temporal.PlainDate.from(date).toPlainYearMonth() : Temporal.Now.plainDateISO().toPlainYearMonth(),
  );

  const { data: days, isLoading, isFetching } = useCalendar(month.toString(), partySize);

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">When would you like to dine?</h1>
        <p className="mt-1 text-sm text-ink-2">Pick a date to see available times.</p>
      </div>

      <PartySizeSelect value={partySize} onChange={setPartySize} />

      <div className="rounded-lg border border-rule bg-paper-2 p-4 shadow-sm sm:p-5">
        <Calendar
          month={month}
          onMonthChange={setMonth}
          days={days}
          isLoading={isLoading || isFetching}
          selectedDate={date}
          onSelectDate={setDate}
        />
      </div>

      {date && (
        <p className="animate-fade-up text-center text-sm text-ink-2">
          Selected date: <span className="font-semibold text-ink">{formatSelectedDate(date)}</span>
        </p>
      )}

      <div className="flex items-center gap-3">
        <Link href="/" className="shrink-0">
          <Button variant="ghost" size="lg">
            Back
          </Button>
        </Link>
        <Button size="lg" fullWidth disabled={!date} onClick={() => router.push("/book/time")}>
          Continue
        </Button>
      </div>
    </div>
  );
}
