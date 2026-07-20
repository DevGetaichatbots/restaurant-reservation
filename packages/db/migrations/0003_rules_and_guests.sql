-- ═══════════════════════════════════════════════════════════════════════════
-- M4–M5 — the policy the restaurant books by, and the people who book.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── reservation_rules ────────────────────────────────────────────────────────
--
-- One row per restaurant. Every value here is set by the owner in the admin
-- panel and enforced server-side on every booking — never only in the UI, which
-- a determined caller can bypass by posting to the API directly.

CREATE TABLE reservation_rules (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id                 uuid NOT NULL UNIQUE
                                  REFERENCES restaurant(id) ON DELETE CASCADE,

  -- ── The brief's seven rules ────────────────────────────────────────────────

  min_advance_booking           integer NOT NULL DEFAULT 2,
  min_advance_unit              time_unit NOT NULL DEFAULT 'hours',

  max_advance_booking           integer NOT NULL DEFAULT 60,
  max_advance_unit              time_unit NOT NULL DEFAULT 'days',

  cancellation_time_limit       integer NOT NULL DEFAULT 4,
  cancellation_time_unit        time_unit NOT NULL DEFAULT 'hours',

  max_guests_per_booking        integer NOT NULL DEFAULT 12,

  allow_same_day_booking        boolean NOT NULL DEFAULT true,
  require_contact_information   boolean NOT NULL DEFAULT true,

  -- ── Booking mode and flexible capacity ─────────────────────────────────────
  --
  -- `booking_mode` replaces the brief's auto_confirm_reservations boolean.

  booking_mode                  booking_mode NOT NULL DEFAULT 'auto_then_manual',

  -- How far past the table grid the restaurant will consider going, per slot.
  --
  -- These are guidance for the admin, not walls. Once the allowance is used up
  -- the guest is offered the waitlist rather than a refusal — the numbers
  -- decide what the guest is *told*, not whether they are heard.
  overflow_parties_per_slot     integer NOT NULL DEFAULT 3,
  overflow_covers_per_slot      integer NOT NULL DEFAULT 12,

  allow_waitlist                boolean NOT NULL DEFAULT true,

  -- ── Request expiry ─────────────────────────────────────────────────────────
  --
  -- A request left pending forever is worse than a decline: the guest books
  -- elsewhere and still turns up expecting a table.
  --
  -- The window is min(expiry_minutes, slot − cutoff_minutes), floored at
  -- expiry_floor_minutes. The floor matters: a request made 90 minutes before
  -- a slot would otherwise compute an expiry in the past and lapse the instant
  -- it was created.
  request_expiry_minutes        integer NOT NULL DEFAULT 90,
  request_expiry_cutoff_minutes integer NOT NULL DEFAULT 120,
  request_expiry_floor_minutes  integer NOT NULL DEFAULT 20,

  -- Below this many minutes remaining, a request is urgent: alert the staff
  -- tablet with sound rather than relying on email, which nobody reads during
  -- service.
  urgent_threshold_minutes      integer NOT NULL DEFAULT 45,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rules_max_guests_positive   CHECK (max_guests_per_booking > 0),
  CONSTRAINT rules_overflow_non_negative CHECK (
    overflow_parties_per_slot >= 0 AND overflow_covers_per_slot >= 0
  ),
  CONSTRAINT rules_expiry_sane CHECK (
    request_expiry_minutes       > 0 AND
    request_expiry_floor_minutes > 0 AND
    request_expiry_floor_minutes <= request_expiry_minutes
  )
);

-- ── guests ───────────────────────────────────────────────────────────────────
--
-- Not in the brief's schema, but required by it: the admin sidebar lists a
-- Customers page, and the deployment section promises a database of "customer
-- records". Neither is possible when a name and phone are only ever copied
-- onto individual reservations.
--
-- Keyed on phone number, so a repeat diner is recognised across bookings and
-- the Customers page has real content — visit count, last visit, no-shows.

CREATE TABLE guests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,

  name           text,
  phone          text,
  email          text,

  -- Maintained as bookings complete. Denormalised on purpose: the Customers
  -- list would otherwise aggregate the whole reservations table on every load.
  visit_count    integer NOT NULL DEFAULT 0,
  no_show_count  integer NOT NULL DEFAULT 0,
  last_visit_at  timestamptz,

  marketing_opt_in boolean NOT NULL DEFAULT false,

  notes          text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- A guest must be reachable somehow, or the record identifies nobody.
  CONSTRAINT guests_contactable CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- Phone is the identity where present. Partial unique indexes rather than
-- column constraints, because either field may legitimately be null.
CREATE UNIQUE INDEX guests_unique_phone
  ON guests (restaurant_id, phone)
  WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX guests_unique_email
  ON guests (restaurant_id, email)
  WHERE email IS NOT NULL;
