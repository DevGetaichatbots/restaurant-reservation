import { restaurantSchema, updateRestaurantSchema } from "@rms/contracts";
import { restaurant } from "@rms/db";
import { eq } from "drizzle-orm";

import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import type { App } from "../../types/app.js";

/** Restaurant profile — name, timezone, contact details. */
export default async function restaurantRoutes(app: App) {
  app.get(
    "/restaurant",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: { tags: ["settings"], summary: "Get restaurant profile", response: { 200: restaurantSchema } },
    },
    async () => {
      const restaurantId = await requireSingleRestaurant(app);
      const [row] = await app.db.select().from(restaurant).where(eq(restaurant.id, restaurantId)).limit(1);
      if (!row) throw new Error("restaurant row disappeared after requireSingleRestaurant resolved it");
      return row;
    },
  );

  app.patch(
    "/restaurant",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["settings"],
        summary: "Update restaurant profile",
        body: updateRestaurantSchema,
        response: { 200: restaurantSchema },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);

      const [updated] = await app.db
        .update(restaurant)
        .set(request.body)
        .where(eq(restaurant.id, restaurantId))
        .returning();

      if (!updated) throw new Error("update returned no row");
      return updated;
    },
  );
}
