import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { errorMessage, fieldErrors, hasCode } from '../../lib/errors';

/** Generic on purpose: never reveal whether the email exists or which part was wrong (F-02). */
export const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect';

/**
 * Puts a failed auth call's errors where they belong: VALIDATION_FAILED issues on their form
 * fields, everything else into one message for the alert above the form.
 * Returns that message, or null when every issue landed on a field.
 */
export function applyAuthError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (hasCode(error, 'INVALID_CREDENTIALS')) return INVALID_CREDENTIALS_MESSAGE;

  if (hasCode(error, 'VALIDATION_FAILED')) {
    const issues = fieldErrors(error);
    let unplaced: string | null = null;
    for (const [path, message] of Object.entries(issues)) {
      const field = fields.find((f) => f === path);
      if (field) setError(field, { type: 'server', message });
      else unplaced ??= message;
    }
    if (Object.keys(issues).length === 0) return errorMessage(error);
    return unplaced;
  }

  // RATE_LIMITED, network errors, 5xx: the server's message is safe to show (07).
  return errorMessage(error);
}
