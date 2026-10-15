import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Header the Vercel middleware adds to every `/api/*` request it proxies (apps/web/middleware.ts,
 * same name there). Closes the D-027 follow-up (go-live 9.1).
 */
export const EDGE_SECRET_HEADER = 'x-pv-edge-secret';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Decides whether this request's `X-Forwarded-For` can be trusted. With trust proxy 2, `req.ip` is
 * the second-to-last entry: the client as Vercel reports it. A request sent straight to the
 * public Render URL can forge that entry, so only requests that carry `EDGE_PROXY_SECRET` keep
 * the header as is. For every other request it is cut down to its last entry, the address that
 * Render itself saw connect, which then becomes `req.ip`. The Stripe webhook and Render's health
 * checks still work: they are only keyed on their real address.
 *
 * The secret header is removed either way, so it never reaches logs or Sentry. Without a secret
 * configured this does nothing (local dev, tests, and production until the secret is set).
 */
export function edgeProxyGuard(secret: string | undefined): RequestHandler {
  if (!secret) return (_req, _res, next) => next();
  const expected = digest(secret);

  return (req, _res, next) => {
    const sent = req.headers[EDGE_SECRET_HEADER];
    delete req.headers[EDGE_SECRET_HEADER];
    const trusted = typeof sent === 'string' && timingSafeEqual(digest(sent), expected);
    if (!trusted) {
      const xff = req.headers['x-forwarded-for'];
      const list = (Array.isArray(xff) ? xff.join(',') : (xff ?? '')).split(',');
      const hop = list[list.length - 1]?.trim();
      if (hop) req.headers['x-forwarded-for'] = hop;
      else delete req.headers['x-forwarded-for'];
    }
    next();
  };
}
