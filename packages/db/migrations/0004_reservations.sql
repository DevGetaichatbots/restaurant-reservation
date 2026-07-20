-- ═══════════════════════════════════════════════════════════════════════════
-- M6 — reservations, and the constraint that makes double-booking impossible.
--
-- This is the most important migration in the project. Everything else is
-- arrangement; this is the guarantee.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE reservations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,

  -- ── Nullable on purpose ────────────────────────────────────────────────────
  --
  -- A booking that is still a *request* holds no table yet. That is what lets
  -- the restaurant accept guests beyond its table grid without weakening the
  -- constraint below: no table, nothing to conflict over.
  --
  -- ON DELETE RESTRICT, not CASCADE — deleting a table must never silently
  -- delete the bookings on it.
  table_id          uuid REFERENCES tables(id) ON DELETE RESTRICT,

  guest_id          uuid REFERENCES guests(id) ON DELETE SET NULL,

  -- Contact details are also copied onto the booking, not only referenced.
  -- If a guest later changes their phone number, historic bookings must still
  -- show who was actually expected that night.
  guest_name        text NOT NULL,
  guest_phone       text,
  guest_email       text,

  party_size        integer NOT NULL,

  -- ── Local date and time are authoritative ──────────────────────────────────
  --
  -- Stored exactly as staff mean them: "Table 5, Thursday, 7:30". The
  -- restaurant's timezone lives on the restaurant row and is applied when these
  -- are compared against the current time.
  reservation_date  date NOT NULL,
  reservation_time  time NOT NULL,

  -- How long this booking holds its table. Copied from the time slot at
  -- creation so that later edits to the slot cannot retroactively change what
  -- an existing booking occupies.
  duration_minutes  integer NOT NULL DEFAULT 90,

  -- ── The range the constraint measures overlap against ──────────────────────
  --
  -- Derived, never written by hand, so it cannot drift from the date and time
  -- above.
  --
  -- Deliberately a `tsrange` (local, no timezone) rather than `tstzrange`:
  --   • every table in one restaurant shares one timezone, so comparing local
  --     timestamps is exactly the right test for "do these two overlap"
  --   • converting local time to an absolute instant is not immutable in
  --     PostgreSQL — timezone rules change — so it cannot appear in a
  --     GENERATED column at all
  --
  -- Daylight-saving is handled where it belongs: when slots are generated, the
  -- application does not offer times inside a skipped hour.
  --
  -- '[)' — start inclusive, end exclusive. A booking ending at 21:00 and one
  -- starting at 21:00 do not overlap, which is what a restaurant means.
  slot_range        tsrange GENERATED ALWAYS AS (
                      tsrange(
                        (reservation_date + reservation_time),
                        (reservation_date + reservation_time
                          + make_interval(mins => duration_minutes)),
                        '[)'
                      )
                    ) STORED,

  status            reservation_status NOT NULL DEFAULT 'requested',

  -- Accepted beyond the table grid. Kept as its own flag rather than inferred
  -- from status, because an overflow booking that is later given a table
  -- becomes 'confirmed' while remaining, historically, an overflow.
  is_overflow       boolean NOT NULL DEFAULT false,

  marketing_opt_in  boolean NOT NULL DEFAULT false,
  source            reservation_source NOT NULL DEFAULT 'direct',

  -- ── Request lifecycle ──────────────────────────────────────────────────────

  requested_at      timestamptz NOT NULL DEFAULT now(),

  -- When this request lapses if nobody answers. Null once decided.
  expires_at        timestamptz,

  decided_at        timestamptz,
  decided_by        text,

  -- ── Idempotency ────────────────────────────────────────────────────────────
  --
  -- A guest double-tapping Confirm, or a client retrying after a dropped
  -- connection, must not produce two bookings. The client sends a key; a repeat
  -- of the same key returns the original booking instead of creating another.
  idempotency_key   text,

  notes             text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reservations_party_positive CHECK (party_size > 0),
  CONSTRAINT reservations_duration_positive CHECK (duration_minutes > 0),

  -- A booking that is confirmed, seated or completed must name a table.
  -- Requests, waitlist entries and overflow may not have one yet.
  CONSTRAINT reservations_seated_needs_table CHECK (
    status NOT IN ('confirmed', 'seated', 'completed')
    OR table_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX reservations_idempotency
  ON reservations (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- THE CONSTRAINT
--
-- Read it plainly: no two live reservations may hold the same table with
-- overlapping time ranges.
--
-- This is not application code that runs before an insert. It is a property of
-- the table. Two simultaneous requests both reach the database; PostgreSQL
-- commits one and rejects the other with SQLSTATE 23P01. There is no window
-- between checking and writing, because there is no separate check.
--
-- The API turns that rejection into a 409 and shows the guest the times still
-- open. A losing race becomes a normal, handled moment rather than two parties
-- arriving for the same table.
--
-- WHY IT IS PARTIAL
--
--   table_id IS NOT NULL
--       Requests hold no table, so they sit outside this rule entirely. The
--       restaurant can accept as many as it likes beyond its physical grid —
--       and the moment an admin assigns a table, the rule applies to them too.
--       Flexibility lives in the un-assigned space; correctness begins the
--       instant a real table is involved.
--
--   status NOT IN (…)
--       A cancelled or completed booking releases its table. Without this the
--       table would stay blocked for the rest of time.
--
-- This holds against the API, against a migration, and against someone typing
-- SQL directly. That is the point of putting it here rather than in code.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE reservations
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    table_id   WITH =,
    slot_range WITH &&
  )
  WHERE (
    table_id IS NOT NULL
    AND status NOT IN ('cancelled', 'completed', 'declined', 'expired', 'no_show')
  );


-- ── Indexes for the queries the three interfaces actually run ────────────────

-- Staff tablet and admin: "today's bookings", "this date range".
CREATE INDEX reservations_by_date
  ON reservations (restaurant_id, reservation_date, reservation_time);

-- The request queue: oldest first, so the guest who waited longest is answered
-- first.
CREATE INDEX reservations_pending_queue
  ON reservations (restaurant_id, requested_at)
  WHERE status IN ('requested', 'waitlisted');

-- The scheduled job that lapses unanswered requests.
CREATE INDEX reservations_expiring
  ON reservations (expires_at)
  WHERE status IN ('requested', 'waitlisted') AND expires_at IS NOT NULL;

-- Availability: which tables are taken on a given date.
CREATE INDEX reservations_table_date
  ON reservations (table_id, reservation_date)
  WHERE table_id IS NOT NULL;

-- Staff search by guest name or phone — "they're at the door, find their
-- booking".
CREATE INDEX reservations_guest_lookup
  ON reservations (restaurant_id, guest_phone);
