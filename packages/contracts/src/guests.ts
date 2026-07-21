import { z } from "zod";

import { uuidSchema } from "./common.js";

export const guestSchema = z.object({
  id: uuidSchema,
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  visitCount: z.number().int(),
  noShowCount: z.number().int(),
  lastVisitAt: z.string().nullable(),
  marketingOptIn: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type GuestDto = z.infer<typeof guestSchema>;

export const listGuestsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  marketingOptIn: z.coerce.boolean().optional(),
});
export type ListGuestsQuery = z.infer<typeof listGuestsQuerySchema>;

export const guestBookingHistoryItemSchema = z.object({
  id: uuidSchema,
  reservationDate: z.string(),
  reservationTime: z.string(),
  partySize: z.number().int(),
  status: z.string(),
  tableName: z.string().nullable(),
});

export const guestDetailSchema = guestSchema.extend({
  history: z.array(guestBookingHistoryItemSchema),
});
export type GuestDetail = z.infer<typeof guestDetailSchema>;

export const updateGuestSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  marketingOptIn: z.boolean().optional(),
});
export type UpdateGuestRequest = z.infer<typeof updateGuestSchema>;
