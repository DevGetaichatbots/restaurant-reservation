import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { CompletedPage } from "./pages/CompletedPage";
import { RequestsPage } from "./pages/RequestsPage";
import { SeatedPage } from "./pages/SeatedPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";
import { UpcomingPage } from "./pages/UpcomingPage";
import { WalkInsPage } from "./pages/WalkInsPage";
import { LoginPage } from "./routes/LoginPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { useDeviceSettingsStore } from "./lib/device-settings-store";

function RootRedirect() {
  const defaultView = useDeviceSettingsStore((s) => s.defaultView);
  return <Navigate to={`/${defaultView}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/upcoming" element={<UpcomingPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/walk-ins" element={<WalkInsPage />} />
            <Route path="/seated" element={<SeatedPage />} />
            <Route path="/completed" element={<CompletedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
