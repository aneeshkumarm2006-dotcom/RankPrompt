import { changePasswordBodySchema, patchMeBodySchema } from '@pv/shared';
import { Router } from 'express';
import { ctxOf } from '../../http/context';
import { validate } from '../../http/validate';
import type { AuthService } from '../auth/service';
import { getMe, updateMe } from './service';

/** `/me` (08). Mounted behind requireAuth. */
export function meRoutes(deps: { auth: AuthService }): Router {
  const router = Router();

  router.get('/me', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await getMe(ctxOf(req)));
  });

  router.patch(
    '/me',
    validate({ body: patchMeBodySchema }, async ({ body }, req, res) => {
      res.json(await updateMe(ctxOf(req), body));
    }),
  );

  router.post(
    '/me/password',
    validate({ body: changePasswordBodySchema }, async ({ body }, req, res) => {
      await deps.auth.changePassword(ctxOf(req), body.currentPassword, body.newPassword);
      res.status(204).end();
    }),
  );

  return router;
}
