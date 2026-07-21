import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "../lib/auth-store";

/** Every route in the dashboard requires a session — there is no public
 *  surface in this app, unlike the guest booking site. */
export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/** Owner-only screens (Rules, Restaurant profile) — staff can see the floor
 *  but not reshape the business's own configuration. */
export function RequireAdmin() {
  const user = useAuthStore((s) => s.user);

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
