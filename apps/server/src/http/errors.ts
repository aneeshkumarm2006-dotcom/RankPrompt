import { ERROR_STATUS, type ErrorCode } from '@pv/shared';

/**
 * The only error type services and controllers throw on purpose. The error middleware turns it
 * into `{ error: { code, message, details? } }` with the status that belongs to the code.
 */
export class AppError extends Error {
  override name = 'AppError';
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message);
    this.status = status ?? ERROR_STATUS[code];
  }
}

/** A missing resource, and also a resource in another workspace: never 403, so ids can't be probed. */
export const notFound = (what = 'Resource'): AppError =>
  new AppError('NOT_FOUND', `${what} not found`);
