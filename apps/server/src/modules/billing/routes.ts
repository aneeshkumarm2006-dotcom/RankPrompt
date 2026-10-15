import { checkoutBodySchema, topupBodySchema } from '@pv/shared';
import express, { Router } from 'express';
import { ctxOf } from '../../http/context';
import { validate } from '../../http/validate';
import type { BillingService } from './service';
import type { WebhookProcessor } from './webhook';

/** `/billing/*` (08 § Billing and credits). Mounted behind requireAuth. */
export function billingRoutes(deps: { billing: BillingService }): Router {
  const router = Router();
  const { billing } = deps;

  router.get('/billing/subscription', async (req, res) => {
    res.json(await billing.subscription(ctxOf(req)));
  });

  router.post(
    '/billing/checkout',
    validate({ body: checkoutBodySchema }, async ({ body }, req, res) => {
      res.json(await billing.checkout(ctxOf(req), body.tier));
    }),
  );

  router.post(
    '/billing/topup',
    validate({ body: topupBodySchema }, async ({ body }, req, res) => {
      res.json(await billing.topup(ctxOf(req), body.pack));
    }),
  );

  router.post('/billing/portal', async (req, res) => {
    res.json(await billing.portal(ctxOf(req)));
  });

  return router;
}

/**
 * `POST /stripe/webhook` (same path as v1, D-018). Mounted before `express.json()` because the
 * signature covers the raw bytes; it skips the Origin check and the global rate limit
 * (`CSRF_EXEMPT_PATHS`) and is authenticated by the signature alone.
 */
export function stripeWebhookRoutes(deps: { processWebhook: WebhookProcessor }): Router {
  const router = Router();
  router.post(
    '/stripe/webhook',
    express.raw({ type: () => true, limit: '1mb' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];
      const reply = await deps.processWebhook(
        req.body as Buffer,
        typeof signature === 'string' ? signature : undefined,
      );
      res.status(reply.status).json(reply.body);
    },
  );
  return router;
}
