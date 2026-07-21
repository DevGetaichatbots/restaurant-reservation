import type { CreateTableRequest, UpdateTableRequest } from "@rms/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "../lib/api";

export const tablesKey = (params: { status?: string; location?: string; includeArchived?: boolean } = {}) =>
  ["tables", "list", params] as const;

export function useTables(
  params: { status?: string; location?: string; includeArchived?: boolean } = {},
  enabled = true,
) {
  return useQuery({ queryKey: tablesKey(params), queryFn: () => apiClient.listTables(params), enabled });
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTableRequest) => apiClient.createTable(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Table added.");
    },
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, force }: { id: string; body: UpdateTableRequest; force?: boolean }) =>
      apiClient.updateTable(id, body, { force }),
    // SEATS_BELOW_BOOKED_PARTY (E-08) is handled by the caller with a
    // confirm-to-force dialog, not a generic error toast.
    meta: { skipGlobalErrorToast: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Table updated.");
    },
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTable(id),
    // TABLE_HAS_ACTIVE_BOOKINGS (E-07) is surfaced by the caller as a
    // specific explanation, not a generic error toast.
    meta: { skipGlobalErrorToast: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("Table removed.");
    },
  });
}
