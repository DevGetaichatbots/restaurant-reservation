"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { path: "/book/date", label: "Date" },
  { path: "/book/time", label: "Time" },
  { path: "/book/table", label: "Table" },
  { path: "/book/details", label: "Details" },
] as const;

/**
 * A literal sequence indicator, not a decorative one: you cannot pick a time
 * before a date or a table before a time, so the order carries information
 * the guest actually needs — how far along they are, and what's still ahead.
 */
export function StepProgress() {
  const pathname = usePathname();
  const currentIndex = STEPS.findIndex((step) => pathname?.startsWith(step.path));

  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Booking progress">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <li key={step.path} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-8 sm:w-8 " +
                (state === "done"
                  ? "bg-primary text-primary-contrast"
                  : state === "current"
                    ? "border-2 border-primary text-primary"
                    : "border border-rule text-ink-3")
              }
              aria-current={state === "current" ? "step" : undefined}
            >
              {state === "done" ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8.5 6.2 12 13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span
              className={
                "hidden text-sm font-medium sm:inline " +
                (state === "upcoming" ? "text-ink-3" : "text-ink")
              }
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <span
                className={"h-px w-4 sm:w-8 " + (state === "done" ? "bg-primary" : "bg-rule")}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
