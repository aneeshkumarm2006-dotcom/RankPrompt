import type { RequestHandler } from 'express';
import { AppError } from '../errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Paths that authenticate by signature instead of cookies, so they skip the CSRF checks. */
export const CSRF_EXEMPT_PATHS = new Set(['/api/stripe/webhook']);

/**
 * CSRF defence (07 § Input handling), on top of `SameSite=Lax` cookies:
 * 1. a state-changing request must carry `Origin` equal to `APP_URL`, otherwise 403;
 * 2. a request body must be JSON, otherwise 415 (rules out cross-site form posts).
 */
export function originCheck(appUrl: string): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.has(req.path)) {
      next();
      return;
    }
    if (req.headers.origin !== appUrl) {
      next(new AppError('FORBIDDEN', 'Cross-origin request blocked'));
      return;
    }
    const hasBody =
      req.headers['transfer-encoding'] !== undefined ||
      Number(req.headers['content-length'] ?? 0) > 0;
    if (hasBody && !req.is('application/json')) {
      next(new AppError('VALIDATION_FAILED', 'Send the body as application/json', undefined, 415));
      return;
    }
    next();
  };
}
