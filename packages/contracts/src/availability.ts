import { z } from "zod";

import { isoDateSchema, isoTimeSchema, uuidSchema } from "./common.js";

export const calendarDayQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM."),
  partySize: z.coerce.number().int().positive().default(2),
});

export const calendarDaySchema = z.object({
  date: isoDateSchema,
  bookable: z.boolean(),
  reason: z
    .enum(["past", "blocked", "closed", "same_day_not_allowed", "too_soon", "too_far_ahead"])
    .optional(),
  blockedReason: z.string().nullable().optional(),
});
export type CalendarDay = z.infer<typeof calendarDaySchema>;

export const slotsQuerySchema = z.object({
  date: isoDateSchema,
  partySize: z.coerce.number().int().positive().default(2),
});

export const slotAvailabilitySchema = z.object({
  startTime: isoTimeSchema,
  endTime: isoTimeSchema,
  /** "available" — at least one table fits, bookable instantly.
   *  "on_request" — no table free, but the restaurant will take a request.
   *  "unavailable" — closed, blocked, outside the advance window, or a full
   *  slot in Automatic mode, which never queues (proposal §07). */
  status: z.enum(["available", "on_request", "unavailable"]),
});
export type SlotAvailability = z.infer<typeof slotAvailabilitySchema>;

export const tablesQuerySchema = z.object({
  date: isoDateSchema,
  time: isoTimeSchema,
  partySize: z.coerce.number().int().positive().default(2),
});

export const tableAvailabilitySchema = z.object({
  id: uuidSchema,
  tableName: z.string(),
  seats: z.number().int(),
  location: z.string(),
  status: z.enum(["available", "occupied", "too_small"]),
});
export type TableAvailability = z.infer<typeof tableAvailabilitySchema>;
