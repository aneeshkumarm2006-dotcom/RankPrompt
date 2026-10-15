import { rewrite } from '@vercel/functions';

/**
 * Header that proves a request came through our Vercel project (D-027 follow-up, go-live 9.1).
 * The API trusts `X-Forwarded-For` only when it carries `EDGE_PROXY_SECRET`
 * (apps/server/src/http/middleware/edgeProxy.ts uses the same name).
 */
export const EDGE_SECRET_HEADER = 'x-pv-edge-secret';

export interface ApiProxyEnv {
  /** The existing Render service, e.g. `https://<service>.onrender.com` (no path). */
  API_ORIGIN?: string | undefined;
  /** Same value as the API's `EDGE_PROXY_SECRET`. */
  EDGE_PROXY_SECRET?: string | undefined;
}

/**
 * Rewrites `/api/*` to the Render service and adds the secret header. Vercel overwrites
 * `X-Forwarded-For` with the client address before this runs, so the API can trust it once the
 * header checks out. The browser keeps talking to its own origin, so cookies stay first-party.
 *
 * A rewrite with `request.headers` replaces the upstream headers with exactly this set: every
 * incoming header is kept except `host`, which must become the Render host or Render can't route
 * the request.
 */
export function proxyApiRequest(request: Request, env: ApiProxyEnv): Response {
  const origin = parseOrigin(env.API_ORIGIN);
  const secret = env.EDGE_PROXY_SECRET?.trim();
  if (!origin || !secret) {
    return Response.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The API proxy is not configured.' } },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const destination = new URL(url.pathname + url.search, origin);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set(EDGE_SECRET_HEADER, secret);
  return rewrite(destination, { request: { headers } });
}

function parseOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}
