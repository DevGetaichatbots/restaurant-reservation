import {
  createTableSchema,
  tableListQuerySchema,
  tableSchema,
  updateTableSchema,
  uuidSchema,
} from "@rms/contracts";
import { reservations, tables } from "@rms/db";
import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { AppError, NotFoundError } from "../../lib/errors.js";
import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import { isoOrNull, iso } from "../../lib/serialize.js";
import type { App } from "../../types/app.js";

/** Statuses that still occupy a table — the set every "does this table have a
 *  live commitment" check in this module is built around. */
const LIVE_STATUSES = ["requested", "waitlisted", "confirmed", "overflow", "seated"] as const;

/**
 * Table inventory — proposal §10, Module 1.
 *
 * Admin-only throughout: guests and staff never create or reshape the table
 * grid, they only see its current state via /availability and /reservations.
 */
export default async function tablesRoutes(app: App) {
  const restaurantId = await requireSingleRestaurant(app);

  app.get(
    "/",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["tables"],
        summary: "List tables",
        querystring: tableListQuerySchema.extend({
          includeArchived: z.coerce.boolean().default(false),
        }),
        response: { 200: z.array(tableSchema.extend({ upcomingReservations: z.number() })) },
      },
    },
    async (request) => {
      const { status, location, includeArchived } = request.query;

      const rows = await app.db
        .select()
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, restaurantId),
            includeArchived ? undefined : isNull(tables.archivedAt),
            status ? eq(tables.status, status) : undefined,
            location ? eq(tables.location, location) : undefined,
          ),
        )
        .orderBy(tables.tableName);

      return Promise.all(rows.map((row) => withUpcomingCount(app, row)));
    },
  );

  app.get(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["tables"],
        summary: "Get one table",
        params: z.object({ id: uuidSchema }),
        response: { 200: tableSchema.extend({ upcomingReservations: z.number() }) },
      },
    },
    async (request) => {
      const table = await findTableOr404(app, request.params.id, restaurantId);
      return withUpcomingCount(app, table);
    },
  );

  app.post(
    "/",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["tables"],
        summary: "Add a table",
        body: createTableSchema,
        response: { 201: tableSchema },
      },
    },
    async (request, reply) => {
      const [created] = await app.db
        .insert(tables)
        .values({ ...request.body, restaurantId })
        .returning();

      if (!created) throw new Error("insert returned no row");

      reply.status(201);
      return serializeTable(created);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["tables"],
        summary: "Edit a table",
        params: z.object({ id: uuidSchema }),
        querystring: z.object({
          // Bypasses only the seat-reduction warning (E-08) — every other
          // check in this route still applies. See the check below for why
          // this exists rather than a hard rule.
          force: z.coerce.boolean().default(false),
        }),
        body: updateTableSchema,
        response: { 200: tableSchema },
      },
    },
    async (request) => {
      const existing = await findTableOr404(app, request.params.id, restaurantId);

      // E-08: shrinking seats below a party already booked on this table is
      // never silently allowed — the admin sees exactly which bookings would
      // no longer fit and must say so explicitly.
      if (
        request.body.seats !== undefined &&
        request.body.seats < existing.seats &&
        !request.query.force
      ) {
        const affected = await app.db
          .select({ id: reservations.id, guestName: reservations.guestName, partySize: reservations.partySize })
          .from(reservations)
          .where(
            and(
              eq(reservations.tableId, existing.id),
              inArray(reservations.status, [...LIVE_STATUSES]),
              // party larger than the seat count being proposed
              gt(reservations.partySize, request.body.seats),
            ),
          );

        if (affected.length > 0) {
          throw new AppError(
            "SEATS_BELOW_BOOKED_PARTY",
            `${affected.length} upcoming booking(s) have a party size larger than ${request.body.seats}. Confirm to apply anyway.`,
            409,
            { affected },
          );
        }
      }

      const [updated] = await app.db
        .update(tables)
        .set(request.body)
        .where(eq(tables.id, existing.id))
        .returning();

      if (!updated) throw new Error("update returned no row");

      return serializeTable(updated);
    },
  );

  app.delete(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["tables"],
        summary: "Remove a table",
        params: z.object({ id: uuidSchema }),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const existing = await findTableOr404(app, request.params.id, restaurantId);

      // E-07: a table with any live commitment can never be hard- or
      // soft-deleted out from under it. The admin must reassign or cancel
      // those bookings through the reservations module first — deleting here
      // never does it on their behalf.
      const [liveCountRow] = await app.db
        .select({ value: count() })
        .from(reservations)
        .where(and(eq(reservations.tableId, existing.id), inArray(reservations.status, [...LIVE_STATUSES])));
      const liveCount = liveCountRow?.value ?? 0;

      if (liveCount > 0) {
        throw new AppError(
          "TABLE_HAS_ACTIVE_BOOKINGS",
          `This table has ${liveCount} active booking(s). Reassign or cancel them before removing the table.`,
          409,
          { count: liveCount },
        );
      }

      await app.db.update(tables).set({ archivedAt: new Date() }).where(eq(tables.id, existing.id));

      reply.status(204);
    },
  );
}

async function findTableOr404(app: App, id: string, restaurantId: string) {
  const [table] = await app.db
    .select()
    .from(tables)
    .where(and(eq(tables.id, id), eq(tables.restaurantId, restaurantId), isNull(tables.archivedAt)))
    .limit(1);

  if (!table) throw new NotFoundError("Table");
  return table;
}

async function withUpcomingCount(app: App, table: typeof tables.$inferSelect) {
  const [row] = await app.db
    .select({ value: count() })
    .from(reservations)
    .where(and(eq(reservations.tableId, table.id), inArray(reservations.status, [...LIVE_STATUSES])));

  return { ...serializeTable(table), upcomingReservations: row?.value ?? 0 };
}

function serializeTable(table: typeof tables.$inferSelect) {
  return {
    ...table,
    archivedAt: isoOrNull(table.archivedAt),
    createdAt: iso(table.createdAt),
    updatedAt: iso(table.updatedAt),
  };
}
