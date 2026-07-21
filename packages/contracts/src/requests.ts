import { z } from "zod";

import { uuidSchema } from "./common.js";
import { reservationSchema } from "./reservations.js";

export const capacityMeterSchema = z.object({
  tablesOccupied: z.number().int(),
  tablesTotal: z.number().int(),
  overflowPartiesAccepted: z.number().int(),
  overflowPartiesAllowed: z.number().int(),
  overflowCoversAccepted: z.number().int(),
  overflowCoversAllowed: z.number().int(),
  requestsWaitingSameSlot: z.number().int(),
});
export type CapacityMeter = z.infer<typeof capacityMeterSchema>;

export const requestQueueItemSchema = z.object({
  reservation: reservationSchema,
  /** Why this landed in the queue rather than confirming instantly. */
  reason: z.enum(["no_table", "manual_mode"]),
  waitingMinutes: z.number().int(),
  isUrgent: z.boolean(),
  capacity: capacityMeterSchema,
});
export type RequestQueueItem = z.infer<typeof requestQueueItemSchema>;

export const acceptRequestSchema = z.object({
  /** Omit to accept using the table already held on the reservation (the
   *  manual-mode-with-a-free-table case); provide to assign one now. */
  tableId: uuidSchema.optional(),
});
export type AcceptRequestBody = z.infer<typeof acceptRequestSchema>;
