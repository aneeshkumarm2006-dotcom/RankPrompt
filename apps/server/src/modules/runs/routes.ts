import {
  createRunBodySchema,
  estimateRunBodySchema,
  idParamsSchema,
  idempotencyKeySchema,
  listResultsQuerySchema,
  listRunsQuerySchema,
} from '@pv/shared';
import { Router } from 'express';
import { ctxOf } from '../../http/context';
import { AppError } from '../../http/errors';
import { workspaceLimiter, type RateLimitConfig } from '../../http/middleware/rateLimits';
import { validate } from '../../http/validate';
import type { RunsService } from './service';

/** `/runs` (08 § Runs). Mounted behind requireAuth. */
export function runRoutes(deps: { runs: RunsService; limits: RateLimitConfig }): Router {
  const router = Router();

  router.post(
    '/runs/estimate',
    validate({ body: estimateRunBodySchema }, async ({ body }, req, res) => {
      res.json(await deps.runs.estimate(ctxOf(req), body));
    }),
  );

  router.post(
    '/runs',
    workspaceLimiter(deps.limits),
    validate({ body: createRunBodySchema }, async ({ body }, req, res) => {
      const key = idempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
      if (!key.success) {
        throw new AppError('VALIDATION_FAILED', 'Send an Idempotency-Key header', [
          { path: 'headers.idempotency-key', message: key.error.issues[0]?.message ?? 'missing' },
        ]);
      }
      const { run, created } = await deps.runs.create(ctxOf(req), body, key.data);
      res.status(created ? 201 : 200).json(run);
    }),
  );

  router.get(
    '/runs',
    validate({ query: listRunsQuerySchema }, async ({ query }, req, res) => {
      res.json(await deps.runs.list(ctxOf(req), query));
    }),
  );

  router.get(
    '/runs/:id',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.set('Cache-Control', 'no-store').json(await deps.runs.get(ctxOf(req), params.id));
    }),
  );

  router.get(
    '/runs/:id/results',
    validate({ params: idParamsSchema, query: listResultsQuerySchema }, async (input, req, res) => {
      res.json(await deps.runs.results(ctxOf(req), input.params.id, input.query));
    }),
  );

  router.post(
    '/runs/:id/cancel',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.json(await deps.runs.cancel(ctxOf(req), params.id));
    }),
  );

  router.delete(
    '/runs/:id',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      await deps.runs.remove(ctxOf(req), params.id);
      res.status(204).end();
    }),
  );

  router.get(
    '/runs/:id/export.xlsx',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      const file = await deps.runs.exportXlsx(ctxOf(req), params.id);
      res
        .set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'Cache-Control': 'no-store',
        })
        .send(file.body);
    }),
  );

  return router;
}
