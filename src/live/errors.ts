/** An error whose message is already in plain words and safe to show on screen. */
export class TableError extends Error {}

export const NOT_CONNECTED = "This copy of the table isn't connected to its database."

const SOMETHING_WENT_WRONG = 'Something went wrong. Try again in a moment.'

/** Turns a database error into words a player understands. */
export function fromDatabaseError(error: { code?: string; message?: string }): TableError {
  switch (error.code) {
    case 'P0002':
      return new TableError("That code doesn't match a table. Check it with your DM; they may have made a new one.")
    case '42501':
      return new TableError("You're not allowed to do that at this table.")
    case '23514':
      return new TableError('Something you typed is empty or too long.')
  }
  if (/fetch|network/i.test(error.message ?? '')) {
    return new TableError("Couldn't reach the table. Check your internet connection and try again.")
  }
  console.error(error)
  return new TableError(withDetail(error))
}

/** The plain message, with the technical reason after it so a report to Claude can be precise. */
function withDetail(error: { code?: string; message?: string }): string {
  const detail = [error.code, error.message].filter(Boolean).join(': ').slice(0, 160)
  return detail ? `${SOMETHING_WENT_WRONG} (Details: ${detail})` : SOMETHING_WENT_WRONG
}

/**
 * A refusal from one of the table's own server functions ("Wait for your turn to move") is already
 * in plain words, so show it as it is; anything else is turned into words as usual.
 */
export function fromServerRule(error: { code?: string; message?: string }): TableError {
  const message = error.message ?? ''
  const ours =
    (error.code === '22023' || error.code === '23505' || error.code === '42501') &&
    /^[A-Z]/.test(message) &&
    !/permission denied|row-level security|violates/i.test(message)
  return ours ? new TableError(message.endsWith('.') ? message : `${message}.`) : fromDatabaseError(error)
}

/** The message to show for anything thrown while loading or saving. */
export function messageFor(error: unknown): string {
  if (error instanceof TableError) return error.message
  console.error(error)
  return error instanceof Error ? withDetail({ message: error.message }) : SOMETHING_WENT_WRONG
}
