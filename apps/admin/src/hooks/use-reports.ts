import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../lib/api";

export function useReportsSummary(from: string, to: string) {
  return useQuery({
    queryKey: ["reports", "summary", from, to],
    queryFn: () => apiClient.getReportsSummary(from, to),
  });
}
