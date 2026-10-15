import {
  createScheduleBodySchema,
  idParamsSchema,
  idempotencyKeySchema,
  patchScheduleBodySchema,
} from '@pv/shared';
import { Router } from 'express';
import { ctxOf } from '../../http/context';
import { AppError } from '../../http/errors';
import { workspaceLimiter, type RateLimitConfig } from '../../http/middleware/rateLimits';
import { validate } from '../../http/validate';
import type { SchedulesService } from './service';

/** `/brands/:id/schedules` and `/schedules` (08 § Schedules). Mounted behind requireAuth. */
export function scheduleRoutes(deps: {
  schedules: SchedulesService;
  limits: RateLimitConfig;
}): Router {
  const router = Router();

  router.get(
    '/brands/:id/schedules',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.json(await deps.schedules.list(ctxOf(req), params.id));
    }),
  );

  router.post(
    '/schedules',
    validate({ body: createScheduleBodySchema }, async ({ body }, req, res) => {
      res.status(201).json(await deps.schedules.create(ctxOf(req), body));
    }),
  );

  router.patch(
    '/schedules/:id',
    validate({ params: idParamsSchema, body: patchScheduleBodySchema }, async (input, req, res) => {
      res.json(await deps.schedules.update(ctxOf(req), input.params.id, input.body));
    }),
  );

  router.post(
    '/schedules/:id/pause',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.json(await deps.schedules.pause(ctxOf(req), params.id));
    }),
  );

  router.post(
    '/schedules/:id/resume',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.json(await deps.schedules.resume(ctxOf(req), params.id));
    }),
  );

  router.post(
    '/schedules/:id/run-now',
    workspaceLimiter(deps.limits),
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      const key = idempotencyKeySchema.safeParse(req.get('Idempotency-Key'));
      if (!key.success) {
        throw new AppError('VALIDATION_FAILED', 'Send an Idempotency-Key header', [
          { path: 'headers.idempotency-key', message: key.error.issues[0]?.message ?? 'missing' },
        ]);
      }
      const { run, created } = await deps.schedules.runNow(ctxOf(req), params.id, key.data);
      res.status(created ? 201 : 200).json(run);
    }),
  );

  router.delete(
    '/schedules/:id',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      await deps.schedules.remove(ctxOf(req), params.id);
      res.status(204).end();
    }),
  );

  return router;
}
