import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api";

export function useCalendar(month: string, partySize: number) {
  return useQuery({
    queryKey: ["availability", "calendar", month, partySize],
    queryFn: () => apiClient.getCalendar(month, partySize),
  });
}

export function useSlots(date: string | null, partySize: number) {
  return useQuery({
    queryKey: ["availability", "slots", date, partySize],
    queryFn: () => apiClient.getSlots(date!, partySize),
    enabled: Boolean(date),
    // Slots reflect other guests' live activity — refetching on window
    // focus (a guest switching back to this tab after checking their
    // calendar) is worth the extra request here specifically.
    refetchOnWindowFocus: true,
  });
}

export function useTables(date: string | null, time: string | null, partySize: number) {
  return useQuery({
    queryKey: ["availability", "tables", date, time, partySize],
    queryFn: () => apiClient.getTables(date!, time!, partySize),
    enabled: Boolean(date && time),
    refetchOnWindowFocus: true,
  });
}
