"use client";

import type { CalendarDay } from "@rms/contracts";
import { useState } from "react";
import { Temporal } from "temporal-polyfill";

const REASON_LABELS: Record<string, string> = {
  past: "This date has passed.",
  blocked: "The restaurant is closed on this date.",
  closed: "The restaurant doesn't open on this day of the week.",
  same_day_not_allowed: "Same-day bookings aren't available — please choose a later date.",
  too_soon: "This date is too soon to book.",
  too_far_ahead: "This date is too far ahead to book yet.",
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface CalendarProps {
  month: Temporal.PlainYearMonth;
  onMonthChange: (month: Temporal.PlainYearMonth) => void;
  days: CalendarDay[] | undefined;
  isLoading: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function Calendar({ month, onMonthChange, days, isLoading, selectedDate, onSelectDate }: CalendarProps) {
  const [reasonFor, setReasonFor] = useState<string | null>(null);

  const dayMap = new Map((days ?? []).map((d) => [d.date, d]));
  const firstOfMonth = month.toPlainDate({ day: 1 });
  const leadingBlanks = firstOfMonth.dayOfWeek % 7; // Temporal: 1=Mon..7=Sun -> 0=Sun..6=Sat
  const daysInMonth = month.daysInMonth;

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => firstOfMonth.add({ days: i }).toString()),
  ];

  const currentMonth = Temporal.Now.plainDateISO().toPlainYearMonth();
  const canGoPrev = Temporal.PlainYearMonth.compare(month, currentMonth) > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(month.subtract({ months: 1 }))}
          disabled={!canGoPrev}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-paper-3 disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="font-display text-lg font-medium text-ink" aria-live="polite">
          {formatMonth(month)}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(month.add({ months: 1 }))}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-paper-3"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-3">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} aria-hidden="true" />;

          const info = dayMap.get(date);
          const isSelected = date === selectedDate;
          const isBookable = info?.bookable ?? false;
          const dayNum = Number(date.split("-")[2]);

          return (
            <button
              key={date}
              type="button"
              disabled={!info}
              aria-pressed={isSelected}
              aria-label={`${date}${!isBookable && info ? `, unavailable: ${REASON_LABELS[info.reason ?? ""] ?? "not available"}` : ""}`}
              onClick={() => {
                if (isBookable) {
                  onSelectDate(date);
                  setReasonFor(null);
                } else {
                  setReasonFor(reasonFor === date ? null : date);
                }
              }}
              className={
                "flex aspect-square items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                (isSelected
                  ? "bg-primary font-semibold text-primary-contrast shadow-sm"
                  : isBookable
                    ? "text-ink hover:bg-paper-3"
                    : "cursor-pointer text-ink-3/70 line-through decoration-1 hover:bg-paper-2 disabled:cursor-default")
              }
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[2rem]" aria-live="polite">
        {reasonFor && dayMap.get(reasonFor) && (
          <p className="animate-fade-up rounded-md bg-paper-3 px-3 py-2 text-xs text-ink-2">
            {REASON_LABELS[dayMap.get(reasonFor)?.reason ?? ""] ?? "Not available."}
          </p>
        )}
        {isLoading && <p className="text-center text-xs text-ink-3">Checking availability…</p>}
      </div>
    </div>
  );
}

function formatMonth(month: Temporal.PlainYearMonth): string {
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${MONTH_NAMES[month.month - 1]} ${month.year}`;
}
