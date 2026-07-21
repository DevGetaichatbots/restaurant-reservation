import { publicRestaurantSchema } from "@rms/contracts";
import { availabilitySettings, blockedDates, restaurant } from "@rms/db";
import { nowIn } from "@rms/rules";
import { and, eq } from "drizzle-orm";

import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import { normalizeTime } from "../../lib/time.js";
import type { App } from "../../types/app.js";

/**
 * The one piece of restaurant data guests read without logging in — the
 * header on Step 1 of the booking flow (proposal §09): name, contact, and
 * whether the restaurant is open right now. Everything else about the
 * restaurant (rules, hours configuration, tables) stays behind the
 * settings module's admin gate; this route exposes only what a guest needs
 * to see before they've told us anything about themselves.
 */
export default async function publicRestaurantRoutes(app: App) {
  app.get(
    "/",
    {
      schema: {
        tags: ["availability"],
        summary: "Public restaurant profile + open-now status",
        response: { 200: publicRestaurantSchema },
      },
    },
    async () => {
      const restaurantId = await requireSingleRestaurant(app);
      const [row] = await app.db.select().from(restaurant).where(eq(restaurant.id, restaurantId)).limit(1);
      if (!row) throw new Error("restaurant row missing");

      const isOpenNow = await computeIsOpenNow(app, restaurantId, row.timezone);

      return {
        name: row.name,
        phone: row.phone,
        address: row.address,
        logoUrl: row.logoUrl,
        timezone: row.timezone,
        isOpenNow,
      };
    },
  );
}

async function computeIsOpenNow(app: App, restaurantId: string, timezone: string): Promise<boolean> {
  const now = nowIn(timezone);
  const today = now.toPlainDate().toString();

  const [blocked] = await app.db
    .select({ id: blockedDates.id })
    .from(blockedDates)
    .where(and(eq(blockedDates.restaurantId, restaurantId), eq(blockedDates.blockedDate, today)))
    .limit(1);
  if (blocked) return false;

  const pgDayOfWeek = now.dayOfWeek % 7; // Temporal: 1=Mon..7=Sun -> 0=Sun..6=Sat
  const [hours] = await app.db
    .select()
    .from(availabilitySettings)
    .where(and(eq(availabilitySettings.restaurantId, restaurantId), eq(availabilitySettings.dayOfWeek, pgDayOfWeek)))
    .limit(1);
  if (!hours?.isOpen) return false;

  const nowTime = `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}:00`;
  return nowTime >= normalizeTime(hours.openTime) && nowTime < normalizeTime(hours.closeTime);
}
