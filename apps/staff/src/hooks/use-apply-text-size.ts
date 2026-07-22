import { useEffect } from "react";

import { useDeviceSettingsStore } from "../lib/device-settings-store";

/** "Large" bumps the root font size so every rem-based size in the app
 *  scales with it — the Settings page's Text size control (proposal §11)
 *  needs to actually do something, not just persist a value nobody reads. */
export function useApplyTextSize(): void {
  const textSize = useDeviceSettingsStore((s) => s.textSize);

  useEffect(() => {
    document.documentElement.style.fontSize = textSize === "large" ? "112.5%" : "100%";
  }, [textSize]);
}
