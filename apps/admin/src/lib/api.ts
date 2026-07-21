import { createApiClient } from "@rms/api-client";

import { useAuthStore } from "./auth-store";

/** Falls back to the local API in development so `pnpm dev` works with no
 *  env file — production always sets this explicitly (see docs/SETUP.md). */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const apiClient = createApiClient({
  baseUrl: API_URL,
  getToken: () => useAuthStore.getState().token,
});
