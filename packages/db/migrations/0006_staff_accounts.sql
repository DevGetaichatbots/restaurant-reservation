-- ═══════════════════════════════════════════════════════════════════════════
-- M9 — staff accounts.
--
-- Not in the original schema, and added for a specific, temporary reason:
-- proposal §03 commits to Amazon Cognito for admin/staff authentication, but
-- Cognito is an AWS service and the client has not yet provided AWS
-- credentials (see project notes). The admin dashboard and staff tablet still
-- need real authentication during local and Render-hosted development.
--
-- This table is deliberately built to make that swap painless later: it
-- stores only what a JWT needs to carry as claims (id, role, restaurant),
-- never anything Cognito-specific. Migrating means pointing the auth plugin
-- at Cognito's JWKS endpoint instead of verifying our own signature — the
-- rest of the API (every route's requireRole check) does not change.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE staff_role AS ENUM ('admin', 'staff');

CREATE TABLE staff_accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,

  name           text NOT NULL,
  email          text NOT NULL,

  -- bcrypt hash. Never the plaintext, never reversible.
  password_hash  text NOT NULL,

  role           staff_role NOT NULL DEFAULT 'staff',

  is_active      boolean NOT NULL DEFAULT true,

  last_login_at  timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_accounts_unique_email UNIQUE (restaurant_id, email)
);

CREATE TRIGGER staff_accounts_updated_at
  BEFORE UPDATE ON staff_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
