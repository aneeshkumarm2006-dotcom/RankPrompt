import { createShareBodySchema, idParamsSchema, shareTokenParamsSchema } from '@pv/shared';
import { Router, type RequestHandler } from 'express';
import { ctxOf } from '../../http/context';
import { validate } from '../../http/validate';
import type { SharesService } from './service';

/** Owner share management (08 § Runs). Mounted behind requireAuth. */
export function shareRoutes(deps: { shares: SharesService }): Router {
  const router = Router();

  router.post(
    '/runs/:id/shares',
    validate({ params: idParamsSchema, body: createShareBodySchema }, async (input, req, res) => {
      res.status(201).json(await deps.shares.create(ctxOf(req), input.params.id, input.body));
    }),
  );

  router.get(
    '/runs/:id/shares',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.json(await deps.shares.list(ctxOf(req), params.id));
    }),
  );

  router.delete(
    '/shares/:id',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      await deps.shares.revoke(ctxOf(req), params.id);
      res.status(204).end();
    }),
  );

  return router;
}

/** `GET /public/shares/:token` (07): public, rate-limited per IP, never indexed. */
export function publicShareRoutes(deps: {
  shares: SharesService;
  limiter: RequestHandler;
}): Router {
  const router = Router();

  router.get(
    '/public/shares/:token',
    deps.limiter,
    validate({ params: shareTokenParamsSchema }, async ({ params }, _req, res) => {
      const report = await deps.shares.publicReport(params.token);
      res.set({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'private, max-age=60' }).json(report);
    }),
  );

  return router;
}
