import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "../lib/auth-store";

/** Reservations and the request queue have no role restriction server-side
 *  (only tables/settings/guests/reports do — see apps/admin's identical
 *  note) — an admin account works here too, but every screen in this app
 *  only ever calls endpoints staff can already reach. */
export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);

  if (!token) return <Navigate to="/login" replace />;

  return <Outlet />;
}
