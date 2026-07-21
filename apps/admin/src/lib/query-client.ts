import { ApiClientError } from "@rms/api-client";
import { MutationCache, QueryCache, QueryClient, type Mutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuthStore } from "./auth-store";

/** A session that has expired or been revoked surfaces as a 401 from any
 *  endpoint — handled in exactly one place rather than in every hook.
 *
 *  A mutation that wants to handle a specific error code itself (e.g. a
 *  409 that should open a "confirm anyway" dialog rather than just a toast)
 *  opts out via `meta: { skipGlobalErrorToast: true }` — otherwise this
 *  toast and the mutation's own `onError` would both fire for the same
 *  failure. */
function handleError(error: unknown, mutation?: Mutation<unknown, unknown, unknown, unknown>) {
  if (mutation?.meta?.skipGlobalErrorToast) return;

  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      useAuthStore.getState().logout();
      return;
    }
    toast.error(error.message);
    return;
  }
  toast.error("Something went wrong. Please try again.");
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
  queryCache: new QueryCache({ onError: (error) => handleError(error) }),
  mutationCache: new MutationCache({ onError: (error, _vars, _ctx, mutation) => handleError(error, mutation) }),
});
