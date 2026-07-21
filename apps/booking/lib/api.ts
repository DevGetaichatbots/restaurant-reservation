import { createApiClient } from "@rms/api-client";

/** Falls back to the local API in development so `pnpm dev` works with no
 *  env file — production always sets this explicitly (see docs/SETUP.md). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const apiClient = createApiClient({ baseUrl: API_URL });
