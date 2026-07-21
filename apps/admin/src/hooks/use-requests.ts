import type { AcceptRequestBody } from "@rms/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "../lib/api";

export const requestsKey = ["requests", "queue"] as const;

export function useRequests() {
  return useQuery({
    queryKey: requestsKey,
    queryFn: () => apiClient.listRequests(),
    // The queue is the one screen worth refreshing on a timer even without
    // an event — expiry countdowns (urgent flag) move without any write
    // happening anywhere.
    refetchInterval: 30_000,
  });
}

function useInvalidateAfterDecision() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["requests"] });
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };
}

export function useAcceptRequest() {
  const invalidate = useInvalidateAfterDecision();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AcceptRequestBody }) => apiClient.acceptRequest(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("Request accepted and table assigned.");
    },
  });
}

export function useAcceptRequestOverflow() {
  const invalidate = useInvalidateAfterDecision();
  return useMutation({
    mutationFn: (id: string) => apiClient.acceptRequestOverflow(id),
    onSuccess: () => {
      invalidate();
      toast.success("Accepted as overflow — assign a table when one is free.");
    },
  });
}

export function useDeclineRequest() {
  const invalidate = useInvalidateAfterDecision();
  return useMutation({
    mutationFn: (id: string) => apiClient.declineRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success("Request declined.");
    },
  });
}
