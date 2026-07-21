import type { UpdateReservationRulesRequest } from "@rms/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "../lib/api";

export const rulesKey = ["settings", "rules"] as const;

export function useRules(enabled = true) {
  return useQuery({ queryKey: rulesKey, queryFn: () => apiClient.getRules(), enabled });
}

export function useUpdateRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateReservationRulesRequest) => apiClient.updateRules(body),
    onSuccess: (data) => {
      queryClient.setQueryData(rulesKey, data.rules);
      if (data.pendingRequestsWarning > 0) {
        toast.warning(
          `${data.pendingRequestsWarning} request(s) are still waiting on a decision — switching to Automatic mode doesn't resolve them. Review the request queue.`,
        );
      } else {
        toast.success("Rules updated.");
      }
    },
  });
}
