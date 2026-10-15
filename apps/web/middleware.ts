import { proxyApiRequest } from './src/edge/apiProxy';

/**
 * Vercel Routing Middleware (go-live 9.1): proxies `/api/*` to the Render service with the
 * edge secret header. Set `API_ORIGIN` and `EDGE_PROXY_SECRET` in the Vercel project
 * (ops/go-live.md). Local dev doesn't use this file: Vite proxies `/api` itself.
 */
export const config = { matcher: '/api/:path*' };

export default function middleware(request: Request): Response {
  return proxyApiRequest(request, process.env);
}
