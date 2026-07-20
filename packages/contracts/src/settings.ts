import { z } from "zod";

import { isoTimeSchema, uuidSchema } from "./common.js";

// ── Restaurant profile ────────────────────────────────────────────────────

export const restaurantSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  timezone: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  logoUrl: z.string().nullable(),
});
export type RestaurantDto = z.infer<typeof restaurantSchema>;

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
});
export type UpdateRestaurantRequest = z.infer<typeof updateRestaurantSchema>;

// ── Opening hours ──────────────────────────────────────────────────────────
//
// Always exactly 7 rows (0=Sunday..6=Saturday), so this is a bulk-replace
// endpoint rather than individual CRUD — the admin's "Opening Hours" tab in
// proposal §10 edits all seven at once.

export const dayHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: isoTimeSchema,
  closeTime: isoTimeSchema,
  isOpen: z.boolean(),
});
export type DayHours = z.infer<typeof dayHoursSchema>;

export const setHoursRequestSchema = z.object({
  days: z.array(dayHoursSchema).length(7, "All seven days must be included."),
});
export type SetHoursRequest = z.infer<typeof setHoursRequestSchema>;

export const dayHoursResponseSchema = dayHoursSchema.extend({ id: uuidSchema });

// ── Time slots ─────────────────────────────────────────────────────────────

export const timeSlotSchema = z.object({
  id: uuidSchema,
  startTime: isoTimeSchema,
  endTime: isoTimeSchema,
  durationMinutes: z.number().int().positive(),
  isActive: z.boolean(),
});
export type TimeSlotDto = z.infer<typeof timeSlotSchema>;

export const createTimeSlotSchema = z.object({
  startTime: isoTimeSchema,
  endTime: isoTimeSchema,
  durationMinutes: z.number().int().positive().default(90),
  isActive: z.boolean().default(true),
});
export type CreateTimeSlotRequest = z.infer<typeof createTimeSlotSchema>;

export const updateTimeSlotSchema = createTimeSlotSchema.partial();
export type UpdateTimeSlotRequest = z.infer<typeof updateTimeSlotSchema>;

// ── Blocked dates ────────────────────────────────────────────────────────

export const blockedDateSchema = z.object({
  id: uuidSchema,
  blockedDate: z.string(),
  reason: z.string().nullable(),
});
export type BlockedDateDto = z.infer<typeof blockedDateSchema>;

export const createBlockedDateSchema = z.object({
  blockedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD."),
  reason: z.string().max(200).nullable().optional(),
});
export type CreateBlockedDateRequest = z.infer<typeof createBlockedDateSchema>;

/** Block a contiguous range in one call — a holiday closure is rarely one day. */
export const createBlockedRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).nullable().optional(),
});
export type CreateBlockedRangeRequest = z.infer<typeof createBlockedRangeSchema>;

// ── Reservation rules ────────────────────────────────────────────────────

export const timeUnitSchema = z.enum(["hours", "days"]);
export const bookingModeSchema = z.enum(["automatic", "manual", "auto_then_manual"]);

export const reservationRulesSchema = z.object({
  minAdvanceBooking: z.number().int().positive(),
  minAdvanceUnit: timeUnitSchema,
  maxAdvanceBooking: z.number().int().positive(),
  maxAdvanceUnit: timeUnitSchema,
  cancellationTimeLimit: z.number().int().positive(),
  cancellationTimeUnit: timeUnitSchema,
  maxGuestsPerBooking: z.number().int().positive(),
  allowSameDayBooking: z.boolean(),
  requireContactInformation: z.boolean(),
  bookingMode: bookingModeSchema,
  overflowPartiesPerSlot: z.number().int().min(0),
  overflowCoversPerSlot: z.number().int().min(0),
  allowWaitlist: z.boolean(),
  requestExpiryMinutes: z.number().int().positive(),
  requestExpiryCutoffMinutes: z.number().int().positive(),
  requestExpiryFloorMinutes: z.number().int().positive(),
  urgentThresholdMinutes: z.number().int().positive(),
});
export type ReservationRulesDto = z.infer<typeof reservationRulesSchema>;

export const updateReservationRulesSchema = reservationRulesSchema.partial();
export type UpdateReservationRulesRequest = z.infer<typeof updateReservationRulesSchema>;

/**
 * E-11: switching to Automatic mode while requests are still waiting.
 *
 * A request has no table assigned yet — that is what "requested" means — so
 * it cannot be bulk-confirmed the way the brief's original Pending→Confirmed
 * toggle implied; the database's own CHECK constraint refuses a confirmed
 * booking without a table. Automatic mode also never queues new requests
 * (§07), so an existing queue does not resolve itself either. This is
 * therefore a warning, not an action: the admin still resolves each one
 * through the request queue regardless of which mode is active.
 */
export const updateReservationRulesResponseSchema = z.object({
  rules: reservationRulesSchema,
  pendingRequestsWarning: z.number().int().min(0),
});
export type UpdateReservationRulesResponse = z.infer<typeof updateReservationRulesResponseSchema>;
