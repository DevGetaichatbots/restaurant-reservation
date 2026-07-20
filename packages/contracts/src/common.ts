import { z } from "zod";

/** ISO calendar date, e.g. "2026-08-14". Used everywhere a guest picks a date
 *  rather than a full timestamp. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD.");

/** 24-hour time-of-day, e.g. "19:30". */
export const isoTimeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM.");

export const uuidSchema = z.string().uuid();
