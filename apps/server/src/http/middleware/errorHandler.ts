import type { ErrorEnvelope } from '@pv/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ErrorReporter } from '../../config/sentry';
import { AppError } from '../errors';
import type { ErrorSpikeAlarm } from './errorSpike';
import { maskUrl } from './requestLogger';

const GENERIC_5XX = 'Something went wrong. Please try again.';

/** Errors raised by express.json() (body-parser) carry a `type` and a 4xx `status`. */
const isBodyParserError = (err: unknown): err is { type: string; status: number } =>
  typeof err === 'object' &&
  err !== null &&
  typeof (err as { type?: unknown }).type === 'string' &&
  typeof (err as { status?: unknown }).status === 'number';

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return new AppError('VALIDATION_FAILED', 'The request is not valid', details);
  }
  if (isBodyParserError(err) && err.status >= 400 && err.status < 500) {
    if (err.type === 'entity.parse.failed') {
      return new AppError('VALIDATION_FAILED', 'The request body is not valid JSON');
    }
    if (err.type === 'entity.too.large') {
      return new AppError('VALIDATION_FAILED', 'The request body is too large', undefined, 413);
    }
    return new AppError(
      'VALIDATION_FAILED',
      'The request body could not be read',
      undefined,
      err.status,
    );
  }
  return new AppError('INTERNAL', GENERIC_5XX);
}

/** Unknown routes get the same envelope as every other error. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

/**
 * Last middleware. 5xx bodies carry a generic message and the request id only: stack traces and
 * provider messages never reach clients (07). 5xx errors are logged and reported.
 */
export function errorHandler(
  reporter: ErrorReporter,
  spike?: ErrorSpikeAlarm,
): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const appError = toAppError(err);
    const requestId = typeof req.id === 'object' ? JSON.stringify(req.id) : String(req.id);

    if (appError.status >= 500) {
      req.log.error({ err }, 'request failed');
      reporter.capture(err, { requestId, method: req.method, path: maskUrl(req.path) });
      spike?.record();
    }

    const body: ErrorEnvelope = {
      error: {
        code: appError.code,
        message: appError.status >= 500 ? GENERIC_5XX : appError.message,
        ...(appError.details !== undefined && appError.status < 500
          ? { details: appError.details }
          : {}),
        requestId,
      },
    };
    res.status(appError.status).json(body);
  };
}
