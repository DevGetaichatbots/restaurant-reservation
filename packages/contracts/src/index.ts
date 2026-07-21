/**
 * Request and response shapes, written once as Zod schemas.
 *
 * This package is the reason the monorepo exists. The API validates incoming
 * requests with these schemas; the three front-ends validate their forms with
 * the same ones. A rule cannot be enforced on one side and forgotten on the
 * other, because there is only one definition of it.
 *
 * Populated in Sprint 1 alongside the endpoints. Everything here must stay
 * free of database and server imports — a browser bundles this code.
 */

import { z } from "zod";

/** Shared error envelope. Every failed response from the API looks like this. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export * from "./common.js";
export * from "./auth.js";
export * from "./tables.js";
export * from "./settings.js";
export * from "./availability.js";
export * from "./reservations.js";
export * from "./requests.js";
export * from "./public-restaurant.js";
export * from "./guests.js";
export * from "./reports.js";
