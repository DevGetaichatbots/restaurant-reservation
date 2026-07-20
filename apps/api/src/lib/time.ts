/**
 * Normalizes a time-of-day string to a fixed "HH:MM:SS" width.
 *
 * The bug this exists to prevent: Postgres `time` columns always come back
 * from the database as "HH:MM:SS" (e.g. "23:00:00"), while request bodies
 * validated against the contracts' `isoTimeSchema` may arrive as "HH:MM"
 * (e.g. "23:00"). Comparing those two forms with plain string operators is
 * silently wrong — "23:00" < "23:00:00" evaluates to `true` in JavaScript,
 * because a string is lexicographically "less than" any longer string it is
 * a prefix of. Two slots that are genuinely back-to-back (22:30–23:00 and
 * 23:00–23:30) would appear to overlap.
 *
 * Every comparison between a time coming from a request and one coming from
 * the database must normalize both sides through this function first.
 */
export function normalizeTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}
