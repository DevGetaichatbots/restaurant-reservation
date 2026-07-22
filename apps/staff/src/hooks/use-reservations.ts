import type { ListReservationsQuery, ReservationAction } from "@rms/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "../lib/api";

export const reservationsKey = (params: ListReservationsQuery = {}) => ["reservations", "list", params] as const;

export function useReservations(params: ListReservationsQuery = {}) {
  return useQuery({ queryKey: reservationsKey(params), queryFn: () => apiClient.listReservations(params) });
}

const ACTION_LABEL: Record<ReservationAction, string> = {
  seat: "Marked as seated.",
  complete: "Marked as completed.",
  no_show: "Marked as no-show.",
  cancel: "Reservation cancelled.",
};

export function usePerformReservationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: ReservationAction }) =>
      apiClient.performReservationAction(id, action),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success(ACTION_LABEL[variables.action]);
    },
  });
}
