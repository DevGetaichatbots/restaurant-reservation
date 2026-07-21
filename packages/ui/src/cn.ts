import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge ships knowing only Tailwind's own default palette (red,
 * blue, gray, ...). Without telling it about the theme's own color names —
 * primary, danger, success, paper, ink, rule, and so on, all defined in
 * theme.css — it silently fails to recognize e.g. "bg-danger" as a
 * background-color utility at all. The practical symptom: a component that
 * merges classes through `cn()` (any variant built with class-variance-
 * authority) can render with a transparent background while the identical
 * class used as a plain, unmerged string elsewhere renders correctly. Every
 * custom color token added to tokens.css must be added to this list too.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "primary", "primary-hover", "primary-active", "primary-contrast",
        "secondary", "secondary-hover",
        "accent", "accent-contrast",
        "paper", "paper-2", "paper-3",
        "ink", "ink-2", "ink-3",
        "rule",
        "success", "success-subtle",
        "danger", "danger-subtle",
        "warning", "warning-subtle",
        "info", "info-subtle",
      ],
    },
  },
});

/** Combines conditional class names and resolves Tailwind conflicts (the
 *  last conflicting utility wins), so a consumer can override a
 *  component's default classes without fighting specificity. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
