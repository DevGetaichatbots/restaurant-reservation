import { useQueryClient } from "@tanstack/react-query";
import { useLiveReservations } from "@rms/realtime";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { API_URL } from "./lib/api";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { BlockedDatesPage } from "./pages/BlockedDatesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RequestsPage } from "./pages/RequestsPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { RulesPage } from "./pages/RulesPage";
import { TablesPage } from "./pages/TablesPage";
import { LoginPage } from "./routes/LoginPage";
import { ProtectedRoute, RequireAdmin } from "./routes/ProtectedRoute";

function RealtimeBridge() {
  const queryClient = useQueryClient();
  useLiveReservations(`${API_URL}/events`, queryClient);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <RealtimeBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
            <Route path="/requests" element={<RequestsPage />} />

            {/* Everything below is admin-only server-side too (tables,
                settings, guests, and reports routes all add
                requireRole("admin") — see Sidebar.tsx's comment) — gated
                here as well so a staff account can't reach it by URL. */}
            <Route element={<RequireAdmin />}>
              <Route path="/tables" element={<TablesPage />} />
              <Route path="/availability" element={<AvailabilityPage />} />
              <Route path="/blocked-dates" element={<BlockedDatesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings/rules" element={<RulesPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
