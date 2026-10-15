import { buildMetaResponse, buildPlansResponse } from '@pv/shared';
import { Router } from 'express';

/** Public, static config for the web app (08 § Health and config). */
export function metaRoutes(): Router {
  const router = Router();
  const plans = buildPlansResponse();
  const meta = buildMetaResponse();

  router.get('/plans', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json(plans);
  });

  router.get('/meta', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json(meta);
  });

  return router;
}
