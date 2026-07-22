import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Inbox,
  ListChecks,
  LogOut,
  Settings,
  UserPlus,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@rms/ui";

import { useRequests } from "../../hooks/use-requests";
import { useLiveClock } from "../../hooks/use-live-clock";
import { useAuthStore } from "../../lib/auth-store";
import { ThemeToggle } from "../ThemeToggle";

const NAV_ITEMS = [
  { to: "/today", label: "Today", icon: CalendarClock, badge: false },
  { to: "/upcoming", label: "Upcoming", icon: CalendarDays, badge: false },
  { to: "/requests", label: "Requests", icon: Inbox, badge: true },
  { to: "/walk-ins", label: "Walk-ins", icon: UserPlus, badge: false },
  { to: "/seated", label: "Seated", icon: ListChecks, badge: false },
  { to: "/completed", label: "Completed", icon: CheckCircle2, badge: false },
] as const;

export function TopNav() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const now = useLiveClock();
  const requestsQuery = useRequests();
  const pendingCount = requestsQuery.data?.length ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <div className="flex h-16 items-center justify-between px-5">
        <div>
          <p className="font-display text-lg leading-tight text-ink">The Italian Bistro</p>
          <p className="text-xs text-ink-3">Staff Dashboard · {user?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
          <ThemeToggle />
          <NavLink
            to="/settings"
            aria-label="Device settings"
            className={({ isActive }) =>
              cn(
                "inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-ink-3 hover:bg-paper-3 hover:text-ink",
              )
            }
          >
            <Settings size={22} />
          </NavLink>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-paper-3 hover:text-danger"
          >
            <LogOut size={22} />
          </button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-rule px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "relative flex shrink-0 items-center gap-2 rounded-lg px-5 py-3 text-base font-medium transition-colors",
                isActive ? "bg-primary text-primary-contrast" : "text-ink-2 hover:bg-paper-3 hover:text-ink",
              )
            }
          >
            <Icon size={20} strokeWidth={2} aria-hidden="true" />
            {label}
            {badge && pendingCount > 0 && (
              <span className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-primary-contrast">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
