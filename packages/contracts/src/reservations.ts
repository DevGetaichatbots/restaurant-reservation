import { z } from "zod";

import { isoDateSchema, isoTimeSchema, uuidSchema } from "./common.js";

export const reservationStatusSchema = z.enum([
  "requested",
  "waitlisted",
  "confirmed",
  "overflow",
  "seated",
  "completed",
  "cancelled",
  "declined",
  "expired",
  "no_show",
]);
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

export const reservationSourceSchema = z.enum(["gmb", "direct", "walk_in", "phone"]);

/**
 * What a guest submits at the end of the booking flow (proposal §09, Step 5).
 *
 * `tableId` present means the guest picked a table that Step 4 showed as free
 * — the server re-validates that it is *still* free inside the write
 * transaction. Absent means the guest is on the request path: every table
 * that fit was taken, and they are asking the restaurant to find room.
 */
export const createReservationSchema = z.object({
  tableId: uuidSchema.nullable().optional(),
  guestName: z.string().min(1, "Name is required.").max(100),
  guestPhone: z.string().max(30).optional(),
  guestEmail: z.string().email().max(200).optional(),
  partySize: z.number().int().positive(),
  reservationDate: isoDateSchema,
  reservationTime: isoTimeSchema,
  marketingOptIn: z.boolean().default(false),
  source: reservationSourceSchema.default("direct"),
  notes: z.string().max(500).optional(),
});
export type CreateReservationRequest = z.infer<typeof createReservationSchema>;

export const reservationSchema = z.object({
  id: uuidSchema,
  tableId: uuidSchema.nullable(),
  tableName: z.string().nullable(),
  guestName: z.string(),
  guestPhone: z.string().nullable(),
  guestEmail: z.string().nullable(),
  partySize: z.number().int(),
  reservationDate: z.string(),
  reservationTime: z.string(),
  durationMinutes: z.number().int(),
  status: reservationStatusSchema,
  isOverflow: z.boolean(),
  marketingOptIn: z.boolean(),
  source: reservationSourceSchema,
  requestedAt: z.string(),
  expiresAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReservationDto = z.infer<typeof reservationSchema>;

/** What the guest sees on the confirmation screen and manage-booking page —
 *  deliberately narrower than the admin/staff view (no internal notes, no
 *  raw contact echoing beyond what they just typed). */
export const guestReservationViewSchema = reservationSchema.omit({ notes: true });

export const createReservationResponseSchema = z.object({
  reservation: guestReservationViewSchema,
  message: z.string(),
});
export type CreateReservationResponse = z.infer<typeof createReservationResponseSchema>;

export const listReservationsQuerySchema = z.object({
  date: isoDateSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  status: reservationStatusSchema.optional(),
  search: z.string().max(100).optional(),
});
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;

/**
 * Staff-tablet forward progression on an already-tabled reservation. Table
 * assignment itself (turning a request into a confirmed booking) is the
 * Requests module's job, not this one — see proposal §07's accept/assign
 * flow.
 */
export const reservationActionSchema = z.enum(["seat", "complete", "no_show", "cancel"]);
export type ReservationAction = z.infer<typeof reservationActionSchema>;

export const performReservationActionSchema = z.object({
  action: reservationActionSchema,
});
