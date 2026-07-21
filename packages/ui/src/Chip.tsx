import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

const chipStyles = cva(
  [
    "inline-flex items-center justify-center gap-1.5 rounded-full border",
    "px-4 h-11 text-sm font-medium transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
    "disabled:pointer-events-none disabled:opacity-45",
  ],
  {
    variants: {
      state: {
        // A genuinely free slot or table — tappable, becomes the primary
        // color once chosen.
        available: "border-rule bg-paper text-ink hover:border-primary/50 hover:bg-paper-2",
        selected: "border-primary bg-primary text-primary-contrast shadow-sm",
        // Full, but the restaurant will still take a request for it
        // (proposal §07) — deliberately NOT disabled. Never a dead end.
        onRequest: "border-accent/60 bg-accent/10 text-ink hover:border-accent hover:bg-accent/20",
        // Genuinely not offered: outside hours, blocked date, or a slot
        // Automatic mode has closed outright.
        unavailable: "border-rule/60 bg-paper-2 text-ink-3 line-through decoration-1",
      },
    },
    defaultVariants: { state: "available" },
  },
);

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof chipStyles> {}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(({ className, state, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(chipStyles({ state }), className)}
    disabled={disabled || state === "unavailable"}
    aria-pressed={state === "selected"}
    {...props}
  />
));
Chip.displayName = "Chip";
