import {
  competitorsQuerySchema,
  idParamsSchema,
  promptHistoryQuerySchema,
  sourcesQuerySchema,
  trendQuerySchema,
} from '@pv/shared';
import { Router } from 'express';
import { ctxOf } from '../../http/context';
import { validate } from '../../http/validate';
import type { InsightsService } from './service';

/** `/brands/:id/insights/*` (08 § Insights). Mounted behind requireAuth. */
export function insightRoutes(deps: { insights: InsightsService }): Router {
  const router = Router();

  router.get(
    '/brands/:id/insights/overview',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      res.json(await deps.insights.overview(ctxOf(req), params.id));
    }),
  );

  router.get(
    '/brands/:id/insights/trend',
    validate({ params: idParamsSchema, query: trendQuerySchema }, async (input, req, res) => {
      res.json(await deps.insights.trend(ctxOf(req), input.params.id, input.query));
    }),
  );

  router.get(
    '/brands/:id/insights/competitors',
    validate({ params: idParamsSchema, query: competitorsQuerySchema }, async (input, req, res) => {
      res.json(await deps.insights.competitors(ctxOf(req), input.params.id, input.query.runId));
    }),
  );

  router.get(
    '/brands/:id/insights/sources',
    validate({ params: idParamsSchema, query: sourcesQuerySchema }, async (input, req, res) => {
      res.json(await deps.insights.sources(ctxOf(req), input.params.id, input.query));
    }),
  );

  router.get(
    '/brands/:id/insights/prompts',
    validate(
      { params: idParamsSchema, query: promptHistoryQuerySchema },
      async (input, req, res) => {
        res.json(await deps.insights.promptHistory(ctxOf(req), input.params.id, input.query));
      },
    ),
  );

  return router;
}
