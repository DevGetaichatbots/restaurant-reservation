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

/** Adds whole minutes to an "HH:MM" or "HH:MM:SS" time, returning "HH:MM:SS".
 *  Does not wrap past midnight — see the note in slots.routes.ts on why
 *  individual slots are assumed same-day. */
export function addMinutes(time: string, minutes: number): string {
  const [h, m, s] = normalizeTime(time).split(":").map(Number) as [number, number, number];
  const totalMinutes = h * 60 + m + minutes;
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Whether [aStart, aEnd) and [bStart, bEnd) overlap, using the same
 *  half-open convention as the database's exclusion constraint (proposal
 *  §06) — a booking ending exactly when another starts does not overlap it. */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = normalizeTime(aStart);
  const a2 = normalizeTime(aEnd);
  const b1 = normalizeTime(bStart);
  const b2 = normalizeTime(bEnd);
  return a1 < b2 && a2 > b1;
}
