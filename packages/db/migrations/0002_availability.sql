-- ═══════════════════════════════════════════════════════════════════════════
-- M3 — when the restaurant is open, and in what increments it takes bookings.
--
-- Together these two tables decide which time chips a guest sees on Step 3 of
-- the booking flow. A slot is offered only if it exists in `time_slots` AND
-- falls inside that day's opening hours.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── availability_settings ────────────────────────────────────────────────────
--
-- One row per day of week. `day_of_week` follows PostgreSQL's own convention
-- (EXTRACT(DOW …)): 0 = Sunday … 6 = Saturday. Matching the database's
-- numbering avoids an off-by-one every time we compare a date to a schedule.

CREATE TABLE availability_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,

  day_of_week    smallint NOT NULL,

  open_time      time NOT NULL,
  close_time     time NOT NULL,

  -- The per-day on/off toggle in the admin panel. A closed day keeps its hours
  -- so they are still there when the owner reopens it.
  is_open        boolean NOT NULL DEFAULT true,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT availability_day_valid CHECK (day_of_week BETWEEN 0 AND 6),

  -- Deliberately no CHECK that close_time > open_time.
  --
  -- A close time earlier than the open time means service runs past midnight
  -- (23:00–02:00), which is normal for a restaurant and must not be rejected.
  -- The application reads that case as crossing midnight.
  CONSTRAINT availability_one_row_per_day UNIQUE (restaurant_id, day_of_week)
);

-- ── time_slots ───────────────────────────────────────────────────────────────
--
-- The bookable increments, e.g. 30-minute slots from 11:00 to 22:00.
-- `duration_minutes` is how long a booking made in this slot occupies its
-- table — which is what the double-booking constraint in M6 measures overlap
-- against.

CREATE TABLE time_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,

  start_time        time NOT NULL,
  end_time          time NOT NULL,

  -- How long the table is held. Usually longer than the gap between slot start
  -- times: slots may begin every 30 minutes while each booking holds its table
  -- for 90.
  duration_minutes  integer NOT NULL DEFAULT 90,

  is_active         boolean NOT NULL DEFAULT true,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT time_slots_duration_positive CHECK (duration_minutes > 0),
  CONSTRAINT time_slots_unique_start UNIQUE (restaurant_id, start_time)
);

CREATE INDEX time_slots_active
  ON time_slots (restaurant_id, start_time)
  WHERE is_active = true;

-- ── blocked_dates ────────────────────────────────────────────────────────────
--
-- Specific dates the restaurant will not take bookings on — a holiday, a
-- private event, a closure. These override opening hours entirely.
--
-- Blocking a date never cancels bookings already on it. The admin is shown how
-- many exist and decides; silently cancelling a guest's reservation is not
-- something software should do on its own.

CREATE TABLE blocked_dates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,

  blocked_date   date NOT NULL,

  -- Shown to guests on the calendar where given, so a disabled date has a
  -- visible reason rather than being mysteriously unavailable.
  reason         text,

  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blocked_dates_unique UNIQUE (restaurant_id, blocked_date)
);

CREATE INDEX blocked_dates_lookup ON blocked_dates (restaurant_id, blocked_date);
