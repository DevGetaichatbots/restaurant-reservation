/**
 * Timestamp serialization.
 *
 * Drizzle returns `timestamptz` columns as JS `Date` objects; every response
 * schema in @rms/contracts declares them as ISO strings, since that's what
 * crosses JSON and what every front-end actually consumes. Route handlers
 * call these rather than reaching for `.toISOString()` inline, so a `null`
 * timestamp (an unset `archivedAt`, `expiresAt`, etc.) is handled the same
 * way everywhere instead of each handler remembering the ternary itself.
 */
export function iso(value: Date): string {
  return value.toISOString();
}

export function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
