import { z } from "zod";

export const publicRestaurantSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  logoUrl: z.string().nullable(),
  timezone: z.string(),
  isOpenNow: z.boolean(),
});
export type PublicRestaurant = z.infer<typeof publicRestaurantSchema>;
