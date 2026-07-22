import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthUser } from "@rms/contracts";

/** `localStorage`, 12-hour token (see apps/api/src/lib/auth.ts) — a tablet
 *  left open on the pass all shift should not log itself out mid-service
 *  (proposal §11). */
interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "rms-staff-session",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
