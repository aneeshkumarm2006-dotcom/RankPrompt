import {
  analyzeBrandBodySchema,
  createBrandBodySchema,
  idParamsSchema,
  patchBrandBodySchema,
  putCompetitorsBodySchema,
} from '@pv/shared';
import { Router } from 'express';
import { ctxOf } from '../../http/context';
import { workspaceLimiter, type RateLimitConfig } from '../../http/middleware/rateLimits';
import { validate } from '../../http/validate';
import type { BrandsService } from './service';

/** `/brands` (08 § Brands). Mounted behind requireAuth. */
export function brandRoutes(deps: { brands: BrandsService; limits: RateLimitConfig }): Router {
  const router = Router();

  router.post(
    '/brands/analyze',
    workspaceLimiter(deps.limits),
    validate({ body: analyzeBrandBodySchema }, async ({ body }, req, res) => {
      res.json(await deps.brands.analyze(ctxOf(req), body));
    }),
  );

  router.get('/brands', async (req, res) => {
    res.json(await deps.brands.list(ctxOf(req)));
  });

  router.post(
    '/brands',
    validate({ body: createBrandBodySchema }, async ({ body }, req, res) => {
      res.status(201).json(await deps.brands.create(ctxOf(req), body));
    }),
  );

  router.get(
    '/brands/:id',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.json(await deps.brands.get(ctxOf(req), params.id));
    }),
  );

  router.patch(
    '/brands/:id',
    validate({ params: idParamsSchema, body: patchBrandBodySchema }, async (input, req, res) => {
      res.json(await deps.brands.update(ctxOf(req), input.params.id, input.body));
    }),
  );

  router.put(
    '/brands/:id/competitors',
    validate(
      { params: idParamsSchema, body: putCompetitorsBodySchema },
      async (input, req, res) => {
        res.json(
          await deps.brands.setCompetitors(ctxOf(req), input.params.id, input.body.competitors),
        );
      },
    ),
  );

  router.delete(
    '/brands/:id',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      await deps.brands.archive(ctxOf(req), params.id);
      res.status(204).end();
    }),
  );

  return router;
}
