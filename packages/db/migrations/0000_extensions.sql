-- Migration M1 (part 1) — required extensions.
--
-- This runs before anything else because the whole design depends on it.
--
-- btree_gist lets a GiST index mix an equality column with a range column in
-- one constraint. That combination is what makes the double-booking guard
-- possible:
--
--     EXCLUDE USING gist (table_id WITH =, slot_range WITH &&)
--
-- Without this extension that constraint cannot be created, and preventing two
-- guests from holding the same table would fall back to application locks —
-- correctness depending on our code being flawless rather than on the database
-- being unable to comply. See proposal §06.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Used for gen_random_uuid() on older servers. Built in from PostgreSQL 13,
-- kept here so the migration also applies cleanly to an older instance.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
