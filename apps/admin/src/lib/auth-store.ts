import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthUser } from "@rms/contracts";

/**
 * `localStorage`, not `sessionStorage`: a signed-in admin/staff member
 * expects to stay signed in across browser restarts, unlike the guest
 * booking flow's deliberately session-scoped selection.
 */
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
      name: "rms-admin-session",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
