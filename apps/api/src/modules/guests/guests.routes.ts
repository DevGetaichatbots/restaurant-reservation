import { guestDetailSchema, guestSchema, listGuestsQuerySchema, updateGuestSchema, uuidSchema } from "@rms/contracts";
import { guests, reservations, tables } from "@rms/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { NotFoundError } from "../../lib/errors.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import { isoOrNull, iso } from "../../lib/serialize.js";
import type { App } from "../../types/app.js";

/**
 * Customers — proposal §10's Customers page, built on the `guests` table
 * (proposal §05's addition: reservations only ever copy a name and phone
 * onto themselves, so without this table there is nothing here to show).
 *
 * Admin-only: guest contact details are the one thing in this system a
 * public endpoint must never expose in bulk.
 */
export default async function guestsRoutes(app: App) {
  app.get(
    "/",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["guests"],
        summary: "List guests — search by name/phone, filter by marketing opt-in",
        querystring: listGuestsQuerySchema,
        response: { 200: z.array(guestSchema) },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const { search, marketingOptIn } = request.query;

      const rows = await app.db
        .select()
        .from(guests)
        .where(
          and(
            eq(guests.restaurantId, restaurantId),
            marketingOptIn !== undefined ? eq(guests.marketingOptIn, marketingOptIn) : undefined,
            search
              ? or(ilike(guests.name, `%${search}%`), ilike(guests.phone, `%${search}%`), ilike(guests.email, `%${search}%`))
              : undefined,
          ),
        )
        .orderBy(desc(guests.lastVisitAt))
        .limit(200);

      return rows.map(serializeGuest);
    },
  );

  app.get(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["guests"],
        summary: "Guest detail with full booking history",
        params: z.object({ id: uuidSchema }),
        response: { 200: guestDetailSchema },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const guest = await findGuestOr404(app, request.params.id, restaurantId);

      const history = await app.db
        .select({
          id: reservations.id,
          reservationDate: reservations.reservationDate,
          reservationTime: reservations.reservationTime,
          partySize: reservations.partySize,
          status: reservations.status,
          tableName: tables.tableName,
        })
        .from(reservations)
        .leftJoin(tables, eq(reservations.tableId, tables.id))
        .where(eq(reservations.guestId, guest.id))
        .orderBy(desc(reservations.reservationDate), desc(reservations.reservationTime))
        .limit(100);

      return { ...serializeGuest(guest), history };
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["guests"],
        summary: "Update a guest's notes or marketing preference",
        params: z.object({ id: uuidSchema }),
        body: updateGuestSchema,
        response: { 200: guestSchema },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const guest = await findGuestOr404(app, request.params.id, restaurantId);

      const [updated] = await app.db.update(guests).set(request.body).where(eq(guests.id, guest.id)).returning();
      if (!updated) throw new Error("update returned no row");
      return serializeGuest(updated);
    },
  );

  app.delete(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["guests"],
        summary: "Erase a guest's personal data (proposal §12, E-25)",
        params: z.object({ id: uuidSchema }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const restaurantId = await requireSingleRestaurant(app);
      const guest = await findGuestOr404(app, request.params.id, restaurantId);

      // Erase the identity, keep the row: booking-history reservations still
      // reference guestId for reporting, and each reservation already carries
      // its own name/phone snapshot independent of this record — deleting
      // the guest row outright would either orphan that history or (with a
      // cascade) silently corrupt occupancy/utilisation reports that assume
      // every historic reservation still resolves to *a* guest row.
      //
      // The table's own guests_contactable CHECK requires phone or email to
      // be non-null, so blanking both is not possible — email is replaced
      // with a synthetic, non-identifying placeholder instead of left real.
      await app.db
        .update(guests)
        .set({
          name: null,
          phone: null,
          email: `erased-${guest.id}@deleted.invalid`,
          notes: null,
          marketingOptIn: false,
        })
        .where(eq(guests.id, guest.id));

      reply.status(204);
    },
  );
}

async function findGuestOr404(app: App, id: string, restaurantId: string) {
  const [row] = await app.db
    .select()
    .from(guests)
    .where(and(eq(guests.id, id), eq(guests.restaurantId, restaurantId)))
    .limit(1);
  if (!row) throw new NotFoundError("Guest");
  return row;
}

function serializeGuest(row: typeof guests.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    visitCount: row.visitCount,
    noShowCount: row.noShowCount,
    lastVisitAt: isoOrNull(row.lastVisitAt),
    marketingOptIn: row.marketingOptIn,
    notes: row.notes,
    createdAt: iso(row.createdAt),
  };
}
