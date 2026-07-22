import { Outlet } from "react-router-dom";

import { useApplyTextSize } from "../../hooks/use-apply-text-size";
import { RealtimeProvider } from "../../lib/realtime-context";
import { ConnectionBanner } from "./ConnectionBanner";
import { TopNav } from "./TopNav";

export function AppShell() {
  useApplyTextSize();

  return (
    <RealtimeProvider>
      <div className="min-h-dvh bg-paper-2">
        <TopNav />
        <ConnectionBanner />
        <main className="p-5">
          <Outlet />
        </main>
      </div>
    </RealtimeProvider>
  );
}
