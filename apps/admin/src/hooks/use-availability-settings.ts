import type {
  CreateBlockedDateRequest,
  CreateBlockedRangeRequest,
  CreateTimeSlotRequest,
  SetHoursRequest,
  UpdateTimeSlotRequest,
} from "@rms/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "../lib/api";

// ── Opening hours ────────────────────────────────────────────────────────

export const hoursKey = ["settings", "hours"] as const;

export function useHours() {
  return useQuery({ queryKey: hoursKey, queryFn: () => apiClient.getHours() });
}

export function useSetHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetHoursRequest) => apiClient.setHours(body),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: hoursKey });
      if (data.affectedReservations.length > 0) {
        toast.warning(
          `${data.affectedReservations.length} existing booking(s) now fall outside the new hours. They were not changed — review them in Reservations.`,
        );
      } else {
        toast.success("Opening hours updated.");
      }
    },
  });
}

// ── Time slots ───────────────────────────────────────────────────────────

export const slotsKey = ["settings", "slots"] as const;

export function useSlots() {
  return useQuery({ queryKey: slotsKey, queryFn: () => apiClient.listSlots() });
}

export function useCreateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTimeSlotRequest) => apiClient.createSlot(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: slotsKey });
      toast.success("Time slot added.");
    },
  });
}

export function useUpdateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTimeSlotRequest }) => apiClient.updateSlot(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: slotsKey });
      toast.success("Time slot updated.");
    },
  });
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteSlot(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: slotsKey });
      toast.success("Time slot removed.");
    },
  });
}

// ── Blocked dates ────────────────────────────────────────────────────────

export const blockedDatesKey = ["settings", "blocked-dates"] as const;

export function useBlockedDates() {
  return useQuery({ queryKey: blockedDatesKey, queryFn: () => apiClient.listBlockedDates() });
}

export function useBlockDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBlockedDateRequest) => apiClient.blockDate(body),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: blockedDatesKey });
      toast.success(
        data.affectedReservations > 0
          ? `Date blocked. ${data.affectedReservations} existing booking(s) fall on it — they were not changed.`
          : "Date blocked.",
      );
    },
  });
}

export function useBlockDateRange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBlockedRangeRequest) => apiClient.blockDateRange(body),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: blockedDatesKey });
      toast.success(
        data.affectedReservations > 0
          ? `${data.created.length} date(s) blocked. ${data.affectedReservations} existing booking(s) fall in range — they were not changed.`
          : `${data.created.length} date(s) blocked.`,
      );
    },
  });
}

export function useUnblockDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.unblockDate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blockedDatesKey });
      toast.success("Date unblocked.");
    },
  });
}
