import {
  Armchair,
  BarChart3,
  CalendarClock,
  CalendarX,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@rms/ui";

import { useAuthStore } from "../../lib/auth-store";

// Every route below mirrors the server's own preHandler role requirement
// (reservations.routes.ts / requests.routes.ts have none beyond
// `authenticate`; tables/settings/guests/reports all add
// `requireRole("admin")`) — staff never sees a link to a screen whose
// underlying data they're not allowed to fetch.
const STAFF_NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reservations", label: "Reservations", icon: ListChecks },
  { to: "/requests", label: "Request queue", icon: Inbox },
] as const;

const ADMIN_ONLY_NAV_ITEMS = [
  { to: "/tables", label: "Tables", icon: Armchair },
  { to: "/availability", label: "Availability", icon: CalendarClock },
  { to: "/blocked-dates", label: "Blocked dates", icon: CalendarX },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings/rules", label: "Booking rules", icon: Settings },
] as const;

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          isActive ? "bg-primary/10 text-primary" : "text-ink-2 hover:bg-paper-3 hover:text-ink",
        )
      }
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = user?.role === "admin";

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-rule bg-paper">
      <div className="flex h-16 items-center gap-2 border-b border-rule px-5">
        <span className="font-display text-lg text-ink">The Italian Bistro</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {STAFF_NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-rule" />
            {ADMIN_ONLY_NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-rule p-3">
        <div className="flex items-center justify-between rounded-md px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
            <p className="text-xs capitalize text-ink-3">{user?.role}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-paper-3 hover:text-danger"
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
