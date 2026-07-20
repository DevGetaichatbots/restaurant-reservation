-- ═══════════════════════════════════════════════════════════════════════════
-- M7 — the audit log, and the trigger that drives real-time.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── reservation_events ───────────────────────────────────────────────────────
--
-- An append-only record of every status change: who confirmed, who seated, who
-- cancelled, and when. Nothing else in the schema can reconstruct history once
-- a status is overwritten.
--
-- This is what answers "the guest says they cancelled, we say they didn't", and
-- it produces the Reports page essentially for free.

CREATE TABLE reservation_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  from_status     reservation_status,
  to_status       reservation_status NOT NULL,

  -- Who caused it: a guest, a named staff member, or 'system' for the scheduled
  -- jobs. Free text rather than a foreign key, so the log survives even if the
  -- actor's account is later removed.
  actor           text NOT NULL DEFAULT 'system',

  note            text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reservation_events_by_reservation
  ON reservation_events (reservation_id, created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- Real-time: PostgreSQL NOTIFY on every reservation change.
--
-- When a reservation is inserted or its status changes, this trigger emits a
-- NOTIFY on the 'reservation_changed' channel. The API holds one LISTEN
-- connection open, receives that notification, and fans it out to every browser
-- connected over SSE — so a booking made on a phone reaches the admin dashboard
-- and the staff tablet within a second, with no polling.
--
-- The payload is deliberately THIN: an id, the type of change, the date. Never
-- the row itself. The client uses it to invalidate a cache key and refetch
-- through the normal authenticated API. Three reasons:
--
--   • authorisation stays intact — the refetch goes through the same permission
--     checks as any read, instead of the event system re-implementing them
--   • nothing is ever stale — the client fetches current state, not a snapshot
--   • NOTIFY caps at 8000 bytes; sending ids means we never approach it
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION notify_reservation_changed()
RETURNS trigger AS $$
DECLARE
  payload json;
  event_kind text;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    event_kind := 'created';
  ELSIF (OLD.status IS DISTINCT FROM NEW.status) THEN
    event_kind := 'status_changed';
  ELSE
    -- An edit that did not change status (e.g. a note). Not worth waking every
    -- connected client for.
    RETURN NEW;
  END IF;

  payload := json_build_object(
    'kind',           event_kind,
    'id',             NEW.id,
    'restaurant_id',  NEW.restaurant_id,
    'date',           NEW.reservation_date,
    'status',         NEW.status,
    'table_id',       NEW.table_id
  );

  PERFORM pg_notify('reservation_changed', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_notify
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_reservation_changed();


-- ── updated_at maintenance ───────────────────────────────────────────────────
--
-- Keeps updated_at honest on every table that has one, without each write
-- having to remember to set it.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurant_updated_at
  BEFORE UPDATE ON restaurant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER availability_settings_updated_at
  BEFORE UPDATE ON availability_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER time_slots_updated_at
  BEFORE UPDATE ON time_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reservation_rules_updated_at
  BEFORE UPDATE ON reservation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
