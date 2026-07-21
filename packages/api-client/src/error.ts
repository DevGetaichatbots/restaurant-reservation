/**
 * Thrown for every non-2xx response. Carries the API's own error code
 * (e.g. `TABLE_ALREADY_BOOKED`, `RULE_VIOLATION`) so a caller can branch on
 * it — the availability screen re-fetching on a 409, a form surfacing a
 * validation `details` array — without parsing the message text.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** The table/slot a guest picked was taken by someone else in the
   *  meantime — the one error every booking-flow screen should recognise
   *  and handle the same way: refresh availability, don't just show a
   *  generic failure. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}
