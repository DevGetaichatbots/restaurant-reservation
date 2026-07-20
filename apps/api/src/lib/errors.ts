/**
 * Errors the API raises on purpose.
 *
 * Anything thrown as an AppError is considered safe to show a guest: the
 * message is written for a person, not a developer. Unexpected failures are
 * thrown as ordinary Errors and become a generic 500 — see plugins/error-handler.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** The requested thing does not exist. */
export class NotFoundError extends AppError {
  constructor(what: string) {
    super("NOT_FOUND", `${what} could not be found.`, 404);
  }
}

/**
 * A reservation rule rejected this booking — outside opening hours, on a
 * blocked date, past the advance-booking window, and so on.
 *
 * `rule` names which of the rules in proposal §10 refused, so the front-end can
 * point the guest at the step that needs changing rather than showing a dead end.
 */
export class RuleViolationError extends AppError {
  constructor(rule: string, message: string) {
    super("RULE_VIOLATION", message, 422, { rule });
  }
}

/** The table is taken. Raised before we reach the database where we can. */
export class TableUnavailableError extends AppError {
  constructor() {
    super(
      "TABLE_ALREADY_BOOKED",
      "That table was just taken. Here are the times still open.",
      409,
    );
  }
}
