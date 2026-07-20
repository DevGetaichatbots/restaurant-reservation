-- ═══════════════════════════════════════════════════════════════════════════
-- M1–M2 — the restaurant, and the tables it can seat people at.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE table_status AS ENUM ('active', 'inactive');

CREATE TYPE time_unit AS ENUM ('hours', 'days');

-- How a booking arrived. Lets Reports show whether the Google listing is
-- actually producing bookings, which is the whole premise of the project.
CREATE TYPE reservation_source AS ENUM ('gmb', 'direct', 'walk_in', 'phone');

-- Who decides whether a booking is accepted.
--
-- Replaces the brief's `auto_confirm_reservations` boolean, which could express
-- "always automatic" and "always manual" but not the way this restaurant
-- actually works — automatic while tables are free, then a human decision once
-- they are not.
--
--   automatic          free table → confirmed; no free table → slot closes
--   manual             every booking waits for a human
--   auto_then_manual   free table → confirmed; no free table → request queue
CREATE TYPE booking_mode AS ENUM ('automatic', 'manual', 'auto_then_manual');

-- Reservation lifecycle.
--
-- The brief listed pending/confirmed/seated/completed/cancelled. Five more are
-- added, each for a stated reason:
--
--   requested    no free table, or manual mode — awaiting a human decision
--   waitlisted   past the overflow allowance; accepted onto a list rather
--                than refused, so no guest is turned away
--   overflow     accepted beyond the table grid; committed, table decided later
--   declined     the restaurant could not accommodate this one
--   expired      nobody answered in time
--   no_show      the guest never arrived. Without this, no-shows would be
--                recorded as `completed` and every occupancy figure would lie
CREATE TYPE reservation_status AS ENUM (
  'requested',
  'waitlisted',
  'confirmed',
  'overflow',
  'seated',
  'completed',
  'cancelled',
  'declined',
  'expired',
  'no_show'
);

-- ── restaurant ───────────────────────────────────────────────────────────────
--
-- One row today. Exists chiefly for `timezone`: without it, "7:30 PM" means
-- whatever the reader's device thinks it means, and a guest booking from
-- another country gets the wrong hour.

CREATE TABLE restaurant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,

  -- IANA zone, e.g. 'Asia/Karachi'. Never a fixed UTC offset — those break
  -- across daylight-saving changes.
  timezone    text NOT NULL DEFAULT 'Asia/Karachi',

  phone       text,
  email       text,
  address     text,
  logo_url    text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── tables ───────────────────────────────────────────────────────────────────

CREATE TABLE tables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,

  table_name     text NOT NULL,
  seats          integer NOT NULL,
  location       text NOT NULL DEFAULT 'Main Hall',

  -- Inactive tables keep their existing bookings but accept no new ones.
  status         table_status NOT NULL DEFAULT 'active',

  -- Put out for one evening to absorb overflow. Flagged so reports can tell
  -- normal capacity apart from capacity the restaurant flexed into.
  is_temporary   boolean NOT NULL DEFAULT false,

  -- Soft delete. A table with bookings against it must never vanish — that
  -- would orphan real reservations.
  archived_at    timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tables_seats_positive CHECK (seats > 0)
);

-- Enforced here rather than only in the admin form: a duplicate name can
-- otherwise arrive through the API or a direct SQL session, and two "Table 5"s
-- is an incident on the floor.
CREATE UNIQUE INDEX tables_unique_name_per_restaurant
  ON tables (restaurant_id, table_name)
  WHERE archived_at IS NULL;

CREATE INDEX tables_bookable
  ON tables (restaurant_id, status)
  WHERE archived_at IS NULL;
