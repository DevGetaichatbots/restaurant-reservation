import { reservations, tables } from "@rms/db";
import { and, eq } from "drizzle-orm";

import { NotFoundError } from "./errors.js";
import { iso, isoOrNull } from "./serialize.js";
import type { App } from "../types/app.js";

/**
 * Shared between the Reservations and Requests modules — both read and
 * write the same `reservations` row, just through different actions
 * (creation/progression vs. the human decision on something still pending).
 */

export async function findReservationOr404(app: App, id: string, restaurantId: string) {
  const [row] = await app.db
    .select()
    .from(reservations)
    .where(and(eq(reservations.id, id), eq(reservations.restaurantId, restaurantId)))
    .limit(1);
  if (!row) throw new NotFoundError("Reservation");
  return row;
}

export function serializeReservation(row: typeof reservations.$inferSelect, tableName: string | null) {
  return {
    id: row.id,
    tableId: row.tableId,
    tableName,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    guestEmail: row.guestEmail,
    partySize: row.partySize,
    reservationDate: row.reservationDate,
    reservationTime: row.reservationTime,
    durationMinutes: row.durationMinutes,
    status: row.status,
    isOverflow: row.isOverflow,
    marketingOptIn: row.marketingOptIn,
    source: row.source,
    requestedAt: iso(row.requestedAt),
    expiresAt: isoOrNull(row.expiresAt),
    decidedAt: isoOrNull(row.decidedAt),
    notes: row.notes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function withTableName(app: App, row: typeof reservations.$inferSelect) {
  if (!row.tableId) return serializeReservation(row, null);
  const [tableRow] = await app.db
    .select({ tableName: tables.tableName })
    .from(tables)
    .where(eq(tables.id, row.tableId))
    .limit(1);
  return serializeReservation(row, tableRow?.tableName ?? null);
}
