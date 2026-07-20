import { restaurant } from "@rms/db";

import type { App } from "../types/app.js";

/**
 * Single-restaurant assumption, stated once.
 *
 * The schema supports multiple restaurants (every table carries a
 * restaurant_id), but this deployment serves exactly one — there is no
 * multi-tenant routing yet. Every module resolves it through this function
 * rather than repeating "the one restaurant row" logic per handler; adding
 * multi-tenancy later means changing this one function's signature (taking a
 * tenant id from the request instead), not every route in the API.
 */
export async function requireSingleRestaurant(app: App): Promise<string> {
  const [row] = await app.db.select({ id: restaurant.id }).from(restaurant).limit(1);

  if (!row) {
    throw new Error(
      "No restaurant row exists. Run `pnpm db:seed` (or create one via the admin setup flow) before starting the API.",
    );
  }

  return row.id;
}
