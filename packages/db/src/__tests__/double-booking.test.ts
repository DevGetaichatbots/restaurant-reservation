import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "../client.js";
import { reservations, restaurant, tables } from "../schema/index.js";
import { eq, sql } from "drizzle-orm";

/**
 * The guarantee, tested literally.
 *
 * The claim throughout the proposal is that two guests can never hold the same
 * table at the same time — and that this is enforced by the database, not by
 * careful application code. These tests prove it by attacking the database
 * directly: many concurrent inserts for one table and one slot, with no
 * application logic in between. Exactly one must win.
 *
 * Requires DATABASE_URL. In CI it points at a throwaway Postgres; locally, run
 * it against a scratch database, never one with real data — every test wipes
 * the tables it touches.
 */

const connectionString = process.env.DATABASE_URL;

// Skip rather than fail if there is no database — keeps `pnpm test` green on a
// machine that hasn't set one up, while still running everywhere it matters.
const describeIfDb = connectionString ? describe : describe.skip;

describeIfDb("double-booking is impossible", () => {
  let db: Database;
  let close: () => Promise<void>;
  let restaurantId: string;
  let tableId: string;

  beforeAll(async () => {
    const conn = createDatabase(connectionString!);
    db = conn.db;
    close = conn.close;

    const [r] = await db
      .insert(restaurant)
      .values({ name: "Test Bistro", timezone: "Asia/Karachi" })
      .returning();
    restaurantId = r!.id;

    const [t] = await db
      .insert(tables)
      .values({ restaurantId, tableName: "Table 1", seats: 4, location: "Main Hall" })
      .returning();
    tableId = t!.id;
  });

  afterAll(async () => {
    await db.delete(restaurant).where(eq(restaurant.id, restaurantId));
    await close();
  });

  beforeEach(async () => {
    await db.delete(reservations).where(eq(reservations.restaurantId, restaurantId));
  });

  /** One confirmed booking for our table at a given time. */
  function booking(time: string, overrides: Record<string, unknown> = {}) {
    return {
      restaurantId,
      tableId,
      guestName: "Race Tester",
      partySize: 2,
      reservationDate: "2026-08-01",
      reservationTime: time,
      durationMinutes: 90,
      status: "confirmed" as const,
      ...overrides,
    };
  }

  it("rejects a second booking for the same table and exact time", async () => {
    await db.insert(reservations).values(booking("19:00"));

    await expect(db.insert(reservations).values(booking("19:00"))).rejects.toThrow();

    const rows = await db.select().from(reservations);
    expect(rows).toHaveLength(1);
  });

  it("rejects a booking whose time range overlaps an existing one", async () => {
    // 19:00 holds the table until 20:30. A 20:00 booking overlaps.
    await db.insert(reservations).values(booking("19:00"));

    await expect(db.insert(reservations).values(booking("20:00"))).rejects.toThrow();

    expect(await db.select().from(reservations)).toHaveLength(1);
  });

  it("allows a booking that starts exactly when the previous ends", async () => {
    // 19:00 + 90 min ends at 20:30. A 20:30 booking begins as the other frees
    // the table — the '[)' bound means they do not overlap. This is the case a
    // naive "any booking on this table today" check would wrongly reject.
    await db.insert(reservations).values(booking("19:00"));
    await db.insert(reservations).values(booking("20:30"));

    expect(await db.select().from(reservations)).toHaveLength(2);
  });

  it("survives 100 simultaneous bookings — exactly one wins", async () => {
    // The real-world scenario: a Friday rush, a promotion, many guests hitting
    // the same slot at once. Every insert is fired without awaiting the others,
    // so they race inside the database exactly as concurrent requests would.
    const attempts = Array.from({ length: 100 }, () =>
      db
        .insert(reservations)
        .values(booking("19:00", { guestName: `Guest ${Math.random()}` }))
        .then(() => "won" as const)
        .catch(() => "lost" as const),
    );

    const results = await Promise.all(attempts);

    const won = results.filter((r) => r === "won").length;
    const lost = results.filter((r) => r === "lost").length;

    expect(won).toBe(1);
    expect(lost).toBe(99);
    expect(await db.select().from(reservations)).toHaveLength(1);
  });

  it("does NOT block un-assigned requests — flexible capacity coexists", async () => {
    // The other half of the design: a request holds no table, so any number may
    // exist for the same slot. This is what lets the restaurant accept guests
    // beyond its grid without weakening the guarantee above.
    const requests = Array.from({ length: 5 }, (_, i) =>
      db.insert(reservations).values({
        restaurantId,
        tableId: null,
        guestName: `Requester ${i}`,
        partySize: 2,
        reservationDate: "2026-08-01",
        reservationTime: "19:00",
        status: "requested" as const,
      }),
    );

    await expect(Promise.all(requests)).resolves.toBeDefined();

    const rows = await db
      .select()
      .from(reservations)
      .where(eq(reservations.status, "requested"));
    expect(rows).toHaveLength(5);
  });

  it("frees the table once a booking is cancelled", async () => {
    const [first] = await db.insert(reservations).values(booking("19:00")).returning();

    // While it is live, the slot is blocked.
    await expect(db.insert(reservations).values(booking("19:00"))).rejects.toThrow();

    // Cancel it — the partial constraint excludes cancelled rows, so the slot
    // reopens.
    await db
      .update(reservations)
      .set({ status: "cancelled" })
      .where(eq(reservations.id, first!.id));

    await expect(db.insert(reservations).values(booking("19:00"))).resolves.toBeDefined();

    const live = await db
      .select()
      .from(reservations)
      .where(sql`${reservations.status} <> 'cancelled'`);
    expect(live).toHaveLength(1);
  });
});
