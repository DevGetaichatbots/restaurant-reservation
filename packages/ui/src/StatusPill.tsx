import { cn } from "./cn";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-success-subtle text-success",
  seated: "bg-success-subtle text-success",
  completed: "bg-paper-3 text-ink-2",
  requested: "bg-warning-subtle text-warning",
  waitlisted: "bg-warning-subtle text-warning",
  overflow: "bg-info-subtle text-info",
  cancelled: "bg-paper-3 text-ink-3",
  declined: "bg-danger-subtle text-danger",
  expired: "bg-paper-3 text-ink-3",
  no_show: "bg-danger-subtle text-danger",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  requested: "Request pending",
  waitlisted: "Waitlisted",
  overflow: "Confirmed — table pending",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Expired",
  no_show: "No-show",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-paper-3 text-ink-2",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
