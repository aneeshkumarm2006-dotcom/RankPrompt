import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../../config/logger';

const INCOMING_ID = /^[\w-]{8,64}$/;

/**
 * Share tokens and one-time `token=` values are bearer credentials: they never go to the logs or
 * Sentry (8.3).
 */
export const maskUrl = (url: string): string =>
  url.replace(/(\/public\/shares\/)[^/?#]+/g, '$1***').replace(/([?&]token=)[^&#]*/g, '$1***');

/**
 * Gives every request an id (a sane incoming `X-Request-Id` is kept, otherwise a UUID), echoes it
 * in the response header, and logs one line per request with cookies and auth headers redacted.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && INCOMING_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req: { url?: string }) => {
        if (req.url) req.url = maskUrl(req.url);
        return req;
      },
    },
    // Render polls the readiness probe constantly; successful probes are noise.
    autoLogging: { ignore: (req) => req.url === '/api/ready' },
  });
}
