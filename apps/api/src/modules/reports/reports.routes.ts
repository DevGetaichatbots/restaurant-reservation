import { reportsQuerySchema, reportsSummarySchema } from "@rms/contracts";
import { reservations, tables } from "@rms/db";
import { and, eq, gte, lte } from "drizzle-orm";

import { requireSingleRestaurant } from "../../lib/restaurant-context.js";
import type { App } from "../../types/app.js";

/**
 * Reports — proposal §10's Reports page, built entirely from data the
 * system already records (reservations + tables) at no extra storage cost.
 * This is the evidence behind D-02's decisions: whether the Google link is
 * actually producing bookings, how often the restaurant trades beyond its
 * table grid, and whether that overflow allowance (§07, D-10) is set well.
 */
export default async function reportsRoutes(app: App) {
  app.get(
    "/summary",
    {
      preHandler: [app.authenticate, app.requireRole("admin")],
      schema: {
        tags: ["reports"],
        summary: "Bookings, occupancy, and overflow analytics for a date range",
        querystring: reportsQuerySchema,
        response: { 200: reportsSummarySchema },
      },
    },
    async (request) => {
      const restaurantId = await requireSingleRestaurant(app);
      const { from, to } = request.query;

      const inRange = and(
        eq(reservations.restaurantId, restaurantId),
        gte(reservations.reservationDate, from),
        lte(reservations.reservationDate, to),
      );

      const rows = await app.db
        .select({
          status: reservations.status,
          partySize: reservations.partySize,
          source: reservations.source,
          reservationDate: reservations.reservationDate,
          tableId: reservations.tableId,
          isOverflow: reservations.isOverflow,
        })
        .from(reservations)
        .where(inRange);

      const totalBookings = rows.length;
      const completed = rows.filter((r) => r.status === "completed");
      const cancelled = rows.filter((r) => r.status === "cancelled");
      const noShow = rows.filter((r) => r.status === "no_show");
      const declined = rows.filter((r) => r.status === "declined");
      const expired = rows.filter((r) => r.status === "expired");
      const overflowAccepted = rows.filter((r) => r.isOverflow);

      // "Did the guest show up" only has an answer for bookings the
      // restaurant actually held a table for and the night has passed —
      // completed + no-show is that denominator, not every booking made.
      const showDecisions = completed.length + noShow.length;
      const noShowRate = showDecisions > 0 ? noShow.length / showDecisions : 0;
      const cancellationRate = totalBookings > 0 ? cancelled.length / totalBookings : 0;

      const servedCovers = completed.reduce((sum, r) => sum + r.partySize, 0);
      const averagePartySize = completed.length > 0 ? servedCovers / completed.length : 0;

      const bookingsPerDayMap = new Map<string, number>();
      for (const r of rows) {
        bookingsPerDayMap.set(r.reservationDate, (bookingsPerDayMap.get(r.reservationDate) ?? 0) + 1);
      }
      const bookingsPerDay = [...bookingsPerDayMap.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const sourceMap = new Map<string, number>();
      for (const r of rows) sourceMap.set(r.source, (sourceMap.get(r.source) ?? 0) + 1);
      const sourceBreakdown = [...sourceMap.entries()].map(([source, count]) => ({ source, count }));

      const tableRows = await app.db
        .select({ id: tables.id, tableName: tables.tableName })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId));
      const tableNameById = new Map(tableRows.map((t) => [t.id, t.tableName]));

      const utilMap = new Map<string, { bookings: number; covers: number }>();
      for (const r of rows) {
        if (!r.tableId) continue;
        const entry = utilMap.get(r.tableId) ?? { bookings: 0, covers: 0 };
        entry.bookings += 1;
        entry.covers += r.partySize;
        utilMap.set(r.tableId, entry);
      }
      const tableUtilization = [...utilMap.entries()]
        .map(([tableId, v]) => ({ tableId, tableName: tableNameById.get(tableId) ?? "—", ...v }))
        .sort((a, b) => b.bookings - a.bookings);

      // Overflow/request lifecycle: only requests that were EVER decided one
      // way or another are counted — declined and expired both represent a
      // request that did not become a booking, which is the failure mode
      // the accept rate is meant to surface.
      const overflowDecided = overflowAccepted.length + declined.length + expired.length;
      const acceptRate = overflowDecided > 0 ? overflowAccepted.length / overflowDecided : 0;

      return {
        totalBookings,
        completedBookings: completed.length,
        cancelledBookings: cancelled.length,
        noShowBookings: noShow.length,
        noShowRate,
        cancellationRate,
        totalCovers: servedCovers,
        averagePartySize,
        bookingsPerDay,
        sourceBreakdown,
        tableUtilization,
        overflow: {
          accepted: overflowAccepted.length,
          declined: declined.length,
          expired: expired.length,
          acceptRate,
        },
      };
    },
  );
}
