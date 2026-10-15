import {
  createPromptsBodySchema,
  generatePromptsBodySchema,
  idParamsSchema,
  listPromptsQuerySchema,
  patchPromptBodySchema,
} from '@pv/shared';
import { Router } from 'express';
import { ctxOf } from '../../http/context';
import { workspaceLimiter, type RateLimitConfig } from '../../http/middleware/rateLimits';
import { validate } from '../../http/validate';
import type { PromptsService } from './service';

/** The prompt library (08 § Prompts, D-014). Mounted behind requireAuth. */
export function promptRoutes(deps: { prompts: PromptsService; limits: RateLimitConfig }): Router {
  const router = Router();

  router.get(
    '/brands/:id/prompts',
    validate({ params: idParamsSchema, query: listPromptsQuerySchema }, async (input, req, res) => {
      res.json(await deps.prompts.list(ctxOf(req), input.params.id, input.query.includeArchived));
    }),
  );

  router.post(
    '/brands/:id/prompts/generate',
    workspaceLimiter(deps.limits),
    validate(
      { params: idParamsSchema, body: generatePromptsBodySchema },
      async (input, req, res) => {
        res.json(await deps.prompts.generate(ctxOf(req), input.params.id, input.body));
      },
    ),
  );

  router.post(
    '/brands/:id/prompts',
    validate({ params: idParamsSchema, body: createPromptsBodySchema }, async (input, req, res) => {
      res.status(201).json(await deps.prompts.create(ctxOf(req), input.params.id, input.body));
    }),
  );

  router.patch(
    '/prompts/:id',
    validate({ params: idParamsSchema, body: patchPromptBodySchema }, async (input, req, res) => {
      res.json(await deps.prompts.update(ctxOf(req), input.params.id, input.body));
    }),
  );

  router.delete(
    '/prompts/:id',
    validate({ params: idParamsSchema }, async ({ params }, req, res) => {
      await deps.prompts.archive(ctxOf(req), params.id);
      res.status(204).end();
    }),
  );

  return router;
}
