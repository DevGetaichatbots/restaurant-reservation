import { WifiOff } from "lucide-react";

import { useConnectionBannerStatus } from "../../lib/realtime-context";

/** Only ever shown while genuinely reconnecting after a drop — the brief
 *  initial handshake on launch renders nothing, so a healthy shift never
 *  sees this at all (proposal §11, E-15). */
export function ConnectionBanner() {
  const status = useConnectionBannerStatus();
  if (status !== "reconnecting") return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-warning-subtle px-4 py-2 text-sm font-medium text-warning">
      <WifiOff size={16} className="animate-pulse" />
      Reconnecting… showing the last known list
    </div>
  );
}
