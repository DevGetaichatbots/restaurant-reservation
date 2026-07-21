"use client";

import { Button } from "@rms/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useTables } from "../../../../lib/hooks/use-availability";
import { useBookingStore } from "../../../../lib/booking-store";

export default function SelectTablePage() {
  const router = useRouter();
  const { date, time, partySize, tableId, onRequestPath, chooseTable, chooseRequestPath } = useBookingStore();
  const [locationFilter, setLocationFilter] = useState<string | "all">("all");

  useEffect(() => {
    if (!date || !time) router.replace("/book/date");
  }, [date, time, router]);

  const { data: tables, isLoading } = useTables(date, time, partySize);

  const locations = useMemo(() => {
    const set = new Set((tables ?? []).filter((t) => t.status !== "too_small").map((t) => t.location));
    return ["all", ...Array.from(set)];
  }, [tables]);

  const visible = useMemo(() => {
    const withoutTooSmall = (tables ?? []).filter((t) => t.status !== "too_small");
    return locationFilter === "all" ? withoutTooSmall : withoutTooSmall.filter((t) => t.location === locationFilter);
  }, [tables, locationFilter]);

  const anyAvailable = visible.some((t) => t.status === "available");

  if (!date || !time) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Choose a table</h1>
        <p className="mt-1 text-sm text-ink-2">{partySize} {partySize === 1 ? "guest" : "guests"}</p>
      </div>

      {locations.length > 2 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by location">
          {locations.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocationFilter(loc)}
              className={
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors " +
                (locationFilter === loc
                  ? "border-secondary bg-secondary text-primary-contrast"
                  : "border-rule bg-paper text-ink-2 hover:border-secondary/50")
              }
            >
              {loc === "all" ? "All areas" : loc}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-rule bg-paper-2 p-4 shadow-sm sm:p-5">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-md bg-paper-3" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-2">No tables match this filter.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((table) => {
              const isSelected = table.id === tableId;
              const isOccupied = table.status === "occupied";
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={isOccupied}
                  onClick={() => chooseTable(table.id, table.tableName)}
                  aria-pressed={isSelected}
                  className={
                    "flex flex-col items-center justify-center gap-1 rounded-lg border p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                    (isSelected
                      ? "border-primary bg-primary text-primary-contrast shadow-md scale-[1.02]"
                      : isOccupied
                        ? "cursor-not-allowed border-rule/60 bg-paper-3 text-ink-3"
                        : "border-success/40 bg-success-subtle text-ink hover:border-success hover:shadow-sm")
                  }
                >
                  <TableGlyph seats={table.seats} muted={isOccupied} selected={isSelected} />
                  <span className="text-sm font-semibold">{table.tableName}</span>
                  <span className={"text-xs " + (isSelected ? "text-primary-contrast/80" : "text-ink-3")}>
                    {table.seats} {table.seats === 1 ? "seat" : "seats"}
                  </span>
                  <span className="text-[0.65rem] font-medium uppercase tracking-wide opacity-70">
                    {isSelected ? "Selected" : isOccupied ? "Occupied" : "Available"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && !anyAvailable && (
          <div className="mt-4 rounded-md bg-accent/10 px-4 py-3 text-sm text-ink-2">
            <p className="font-semibold text-ink">All tables are booked at this time.</p>
            <p className="mt-1">
              The restaurant can often still fit you in — send a request and we&rsquo;ll confirm shortly.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                chooseRequestPath();
                router.push("/book/details");
              }}
            >
              Continue without a table
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="lg" onClick={() => router.push("/book/time")}>
          Back
        </Button>
        <Button
          size="lg"
          fullWidth
          disabled={!tableId && !onRequestPath}
          onClick={() => router.push("/book/details")}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function TableGlyph({ seats, muted, selected }: { seats: number; muted: boolean; selected: boolean }) {
  const color = selected ? "currentColor" : muted ? "var(--rms-ink-3)" : "var(--rms-success)";
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="6" y="10" width="20" height="12" rx="2" stroke={color} strokeWidth="1.6" />
      {Array.from({ length: Math.min(seats, 6) }).map((_, i) => {
        const angle = (i / Math.min(seats, 6)) * Math.PI * 2;
        const cx = 16 + Math.cos(angle) * 13;
        const cy = 16 + Math.sin(angle) * 13;
        return <circle key={i} cx={cx} cy={cy} r="1.6" fill={color} />;
      })}
    </svg>
  );
}
