import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Device-local, not account-level (proposal §11's /settings spec): two
 * tablets in the same restaurant — one at the host stand, one by the
 * kitchen — are configured independently, so this is keyed to
 * `localStorage` on this browser alone, never synced through the API.
 */
export type DefaultView = "today" | "upcoming" | "requests";
export type TextSize = "normal" | "large";

interface DeviceSettingsStore {
  soundEnabled: boolean;
  volume: number;
  textSize: TextSize;
  defaultView: DefaultView;
  setSoundEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setTextSize: (v: TextSize) => void;
  setDefaultView: (v: DefaultView) => void;
}

export const useDeviceSettingsStore = create<DeviceSettingsStore>()(
  persist(
    (set) => ({
      soundEnabled: true,
      volume: 0.6,
      textSize: "normal",
      defaultView: "today",
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume }),
      setTextSize: (textSize) => set({ textSize }),
      setDefaultView: (defaultView) => set({ defaultView }),
    }),
    {
      name: "rms-staff-device-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
