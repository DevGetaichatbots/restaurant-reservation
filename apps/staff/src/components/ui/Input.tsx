import { forwardRef } from "react";
import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";

import { cn } from "@rms/ui";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-14 w-full rounded-lg border border-rule bg-paper px-4 text-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-base font-medium text-ink-2", className)} {...props} />;
}
