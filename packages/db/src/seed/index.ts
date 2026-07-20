import { sql } from "drizzle-orm";

import { createDatabase } from "../client.js";
import {
  availabilitySettings,
  blockedDates,
  reservationRules,
  restaurant,
  tables,
  timeSlots,
} from "../schema/index.js";

/**
 * Demo data — a realistic restaurant to develop and test against.
 *
 * The brief's task order builds the guest booking page before the admin
 * dashboard, which is only possible because seed data exists first: the guest
 * flow needs tables, hours, slots and rules to read, weeks before there is an
 * admin UI to create them. This is that data.
 *
 * Idempotent — clears and rebuilds — so it is safe to run repeatedly. It only
 * ever runs against a development or staging database, never production.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  if (connectionString.includes("localhost") === false && process.env.ALLOW_REMOTE_SEED !== "true") {
    console.error(
      "Refusing to seed a non-local database. Set ALLOW_REMOTE_SEED=true to override (staging only).",
    );
    process.exit(1);
  }

  const { db, close } = createDatabase(connectionString);

  try {
    console.log("Seeding…\n");

    // Rebuild from clean. TRUNCATE … CASCADE clears dependent rows too.
    await db.execute(sql`
      TRUNCATE restaurant, tables, availability_settings, time_slots,
               blocked_dates, reservation_rules, guests, reservations,
               reservation_events
      RESTART IDENTITY CASCADE
    `);

    // ── The restaurant ────────────────────────────────────────────────────────
    const [bistro] = await db
      .insert(restaurant)
      .values({
        name: "The Italian Bistro",
        timezone: "Asia/Karachi",
        phone: "+92 300 1234567",
        email: "book@italianbistro.example",
        address: "12 Zamzama Boulevard, Karachi",
      })
      .returning();

    if (!bistro) throw new Error("failed to insert restaurant");
    console.log(`  ✓  restaurant: ${bistro.name}`);

    // ── Tables 1–7, varied seats and locations (per Task 1 acceptance) ─────────
    const tableRows = [
      { tableName: "Table 1", seats: 2, location: "Window Area" },
      { tableName: "Table 2", seats: 2, location: "Window Area" },
      { tableName: "Table 3", seats: 4, location: "Main Hall" },
      { tableName: "Table 4", seats: 4, location: "Main Hall" },
      { tableName: "Table 5", seats: 4, location: "Main Hall" },
      { tableName: "Table 6", seats: 6, location: "Terrace" },
      { tableName: "Table 7", seats: 8, location: "VIP Room" },
    ];
    await db.insert(tables).values(tableRows.map((t) => ({ ...t, restaurantId: bistro.id })));
    console.log(`  ✓  ${tableRows.length} tables (30 seats total)`);

    // ── Opening hours ──────────────────────────────────────────────────────────
    // Closed Mondays; open Tue–Sun. Day 0 = Sunday … 6 = Saturday.
    const hours = [
      { dayOfWeek: 0, openTime: "12:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 1, openTime: "12:00", closeTime: "23:00", isOpen: false }, // Mon closed
      { dayOfWeek: 2, openTime: "12:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 3, openTime: "12:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 4, openTime: "12:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 5, openTime: "12:00", closeTime: "23:30", isOpen: true }, // Fri late
      { dayOfWeek: 6, openTime: "12:00", closeTime: "23:30", isOpen: true }, // Sat late
    ];
    await db
      .insert(availabilitySettings)
      .values(hours.map((h) => ({ ...h, restaurantId: bistro.id })));
    console.log(`  ✓  opening hours (closed Mondays)`);

    // ── Time slots — every 30 minutes, each holding the table 90 minutes ───────
    const slots: { startTime: string; endTime: string }[] = [];
    for (let hour = 12; hour <= 22; hour += 1) {
      for (const minute of [0, 30]) {
        const start = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const endHour = minute === 30 ? hour + 1 : hour;
        const endMin = minute === 30 ? 0 : 30;
        const end = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
        slots.push({ startTime: start, endTime: end });
      }
    }
    await db
      .insert(timeSlots)
      .values(slots.map((s) => ({ ...s, restaurantId: bistro.id, durationMinutes: 90 })));
    console.log(`  ✓  ${slots.length} time slots (30-min, 90-min hold)`);

    // ── Reservation rules — the confirmed decisions D-09..D-12 ─────────────────
    await db.insert(reservationRules).values({
      restaurantId: bistro.id,
      bookingMode: "auto_then_manual", // D-09
      overflowPartiesPerSlot: 3, // D-10
      overflowCoversPerSlot: 12,
      allowWaitlist: true, // D-12
      requestExpiryMinutes: 90, // D-11
      requestExpiryCutoffMinutes: 120,
      requestExpiryFloorMinutes: 20,
      urgentThresholdMinutes: 45,
    });
    console.log(`  ✓  reservation rules (auto-then-manual, overflow 3, waitlist on)`);

    // ── A blocked date, so the guest flow has one to disable ───────────────────
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 20);
    await db.insert(blockedDates).values({
      restaurantId: bistro.id,
      blockedDate: nextMonth.toISOString().slice(0, 10),
      reason: "Private event",
    });
    console.log(`  ✓  1 blocked date`);

    console.log("\nSeed complete.");
  } catch (error) {
    console.error("\nSeed failed:\n", error);
    process.exitCode = 1;
  } finally {
    await close();
  }
}

void main();
