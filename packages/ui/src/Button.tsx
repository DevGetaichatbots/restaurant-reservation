import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";
import { Spinner } from "./Spinner";

const buttonStyles = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium rounded-md transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-primary focus-visible:ring-offset-paper",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-contrast hover:bg-primary-hover active:bg-primary-active shadow-sm",
        secondary: "bg-transparent text-secondary border border-secondary/40 hover:bg-secondary/10",
        ghost: "bg-transparent text-ink-2 hover:bg-paper-3 hover:text-ink",
        danger: "bg-danger text-primary-contrast hover:brightness-90",
      },
      size: {
        // Every interactive target in the guest flow is at least 44px tall
        // — this is used one-handed, often outdoors, on Google's mobile
        // traffic (proposal §09).
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-[52px] px-7 text-lg",
      },
      fullWidth: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size={size === "lg" ? 18 : 16} />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
