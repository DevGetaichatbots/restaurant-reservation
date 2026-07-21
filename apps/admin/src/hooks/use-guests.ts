import type { ListGuestsQuery, UpdateGuestRequest } from "@rms/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "../lib/api";

export const guestsKey = (params: ListGuestsQuery = {}) => ["guests", "list", params] as const;
export const guestKey = (id: string) => ["guests", "detail", id] as const;

export function useGuests(params: ListGuestsQuery = {}) {
  return useQuery({ queryKey: guestsKey(params), queryFn: () => apiClient.listGuests(params) });
}

export function useGuest(id: string | null) {
  return useQuery({
    queryKey: guestKey(id ?? ""),
    queryFn: () => apiClient.getGuest(id as string),
    enabled: id !== null,
  });
}

export function useUpdateGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGuestRequest }) => apiClient.updateGuest(id, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["guests"] });
      void queryClient.invalidateQueries({ queryKey: guestKey(variables.id) });
      toast.success("Customer updated.");
    },
  });
}

export function useDeleteGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteGuest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["guests"] });
      toast.success("Customer data erased.");
    },
  });
}
