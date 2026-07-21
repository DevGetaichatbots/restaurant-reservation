import { z } from "zod";

import { isoDateSchema } from "./common.js";

export const reportsQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

export const bookingsPerDaySchema = z.object({ date: z.string(), count: z.number().int() });

export const sourceBreakdownSchema = z.object({ source: z.string(), count: z.number().int() });

export const tableUtilizationSchema = z.object({
  tableId: z.string(),
  tableName: z.string(),
  bookings: z.number().int(),
  covers: z.number().int(),
});

export const reportsSummarySchema = z.object({
  totalBookings: z.number().int(),
  completedBookings: z.number().int(),
  cancelledBookings: z.number().int(),
  noShowBookings: z.number().int(),
  noShowRate: z.number(),
  cancellationRate: z.number(),
  totalCovers: z.number().int(),
  averagePartySize: z.number(),
  bookingsPerDay: z.array(bookingsPerDaySchema),
  sourceBreakdown: z.array(sourceBreakdownSchema),
  tableUtilization: z.array(tableUtilizationSchema),
  overflow: z.object({
    accepted: z.number().int(),
    declined: z.number().int(),
    expired: z.number().int(),
    acceptRate: z.number(),
  }),
});
export type ReportsSummary = z.infer<typeof reportsSummarySchema>;
