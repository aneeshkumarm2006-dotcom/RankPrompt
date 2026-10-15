/**
 * The API for the Playwright suite (scripts/e2e-api.mjs starts it). It is `main.ts` with two test
 * doubles, so the billing flow can run end to end without a Stripe account or the Stripe CLI:
 *
 * - **Stripe** is the in-memory `FakeStripe` of the server tests. Checkout and the portal send the
 *   browser to small pages under `/api/__e2e/stripe/…` on the web origin. "Pay" there plays
 *   Stripe's part: it completes the session and delivers the same signed webhook events Stripe
 *   would (verified by the real `/api/stripe/webhook` handler), then redirects to the success URL.
 * - **Email** is captured in memory; `GET /api/__e2e/emails?to=` returns what was sent there, so
 *   the suite can open the verify link.
 *
 * Everything else (routes, worker, scheduler, FAKE_PROVIDERS engine) is the real app. This file is
 * never built or deployed (tsup bundles `src/main.ts` only), and it refuses to start in
 * production. Real test-mode Stripe is checked by hand after TODO 6.1 (ops/deployment.md).
 */
import { createServer } from 'node:http';
import express from 'express';
import { loadEnv } from '../src/config/env';
import { createLogger } from '../src/config/logger';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb, pingDb } from '../src/db/connection';
import type { Mailer, OutgoingEmail } from '../src/emails/mailer';
import { createApp } from '../src/http/app';
import { buildIntegrations, type Integrations } from '../src/integrations';
import { createJobWorker } from '../src/jobs/runtime';
import { Scheduler } from '../src/jobs/scheduler';
import type { Worker } from '../src/jobs/worker';
import type { CheckoutRequest } from '../src/modules/billing/gateway';
import { buildServices } from '../src/services';
import { BILLING_ENV, FakeStripe, deliver, signedEvent } from '../test/fakeStripe';

if (process.env.NODE_ENV === 'production') {
  console.error('e2e-server is a test harness and never runs in production');
  process.exit(1);
}
process.env.NODE_ENV ??= 'development';

const env = loadEnv({ ...process.env, ...BILLING_ENV });
const logger = createLogger(env);
const E2E = '/api/__e2e';

/** FakeStripe whose hosted pages live on the web origin, under /api/__e2e/stripe. */
class E2EStripe extends FakeStripe {
  override async createCheckoutSession(r: CheckoutRequest): Promise<{ id: string; url: string }> {
    const { id } = await super.createCheckoutSession(r);
    return { id, url: `${env.APP_URL}${E2E}/stripe/checkout/${id}` };
  }

  override createPortalSession(p: { customerId: string }): Promise<{ url: string }> {
    return Promise.resolve({ url: `${env.APP_URL}${E2E}/stripe/portal/${p.customerId}` });
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>${escape(title)}</title><h1>${escape(title)}</h1>${body}`;

async function main(): Promise<void> {
  await connectDb(env.MONGODB_URI, { logger, autoIndex: true });
  const stripe = new E2EStripe();
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = {
    driver: 'e2e',
    send: (message) => {
      sent.push(message);
      return Promise.resolve({ id: `e2e_${sent.length}` });
    },
  };
  const integrations: Integrations = { ...buildIntegrations(env, logger), billing: stripe, mailer };

  let worker: Worker | null = null;
  const services = buildServices({
    env,
    logger,
    reporter: noopReporter,
    integrations,
    onEnqueued: () => worker?.wake(),
  });
  worker = createJobWorker({
    env,
    logger,
    reporter: noopReporter,
    engine: integrations.checks,
    mailer,
    notifyRunDone: services.notifyRunDone,
  });
  worker.start();
  const scheduler = new Scheduler({
    schedules: services.schedules,
    logger,
    reporter: noopReporter,
  });
  scheduler.start();

  const app = createApp({
    env,
    logger,
    reporter: noopReporter,
    integrations,
    readiness: {
      pingDb,
      workerHeartbeatAgeMs: () => worker?.heartbeatAgeMs() ?? null,
      isShuttingDown: () => false,
    },
    services,
  });

  const outer = express();
  outer.get(`${E2E}/emails`, (req, res) => {
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    res.json(sent.filter((m) => m.to === to).map((m) => ({ template: m.template, text: m.text })));
  });
  outer.get(`${E2E}/stripe/checkout/:id`, (req, res) => {
    const session = stripe.sessions.get(req.params.id);
    if (!session) return void res.status(404).send(page('No such checkout session', ''));
    res
      .type('html')
      .send(
        page(
          'Fake Stripe Checkout',
          `<p>${escape(session.mode)} · ${escape(session.request.priceId)}</p>` +
            `<p><a href="${E2E}/stripe/checkout/${escape(session.id)}/pay">Pay with a test card</a></p>` +
            `<p><a href="${escape(session.request.cancelUrl)}">Cancel</a></p>`,
        ),
      );
  });
  outer.get(`${E2E}/stripe/checkout/:id/pay`, async (req, res, next) => {
    try {
      const session = stripe.sessions.get(req.params.id);
      if (!session) return void res.status(404).send(page('No such checkout session', ''));
      const events = [signedEvent('checkout.session.completed', session.id)];
      if (session.mode === 'subscription') {
        const { subscriptionId, invoiceId } = stripe.completeSubscriptionCheckout(
          session.id,
          new Date(),
        );
        events.push(
          signedEvent('customer.subscription.created', subscriptionId),
          signedEvent('invoice.paid', invoiceId),
        );
      } else {
        stripe.completePaymentCheckout(session.id);
      }
      for (const event of events) {
        const reply = await deliver(app, event);
        if (reply.status !== 200) throw new Error(`webhook ${event.type}: ${reply.status}`);
      }
      res.redirect(303, session.request.successUrl.replace('{CHECKOUT_SESSION_ID}', session.id));
    } catch (err) {
      next(err);
    }
  });
  outer.get(`${E2E}/stripe/portal/:customer`, (_req, res) => {
    res
      .type('html')
      .send(
        page(
          'Fake Stripe billing portal',
          `<p><a href="/app/billing">Return to PromptVerse</a></p>`,
        ),
      );
  });
  outer.use(app);

  const server = createServer(outer).listen(env.PORT, () =>
    logger.info({ port: env.PORT }, 'e2e api listening'),
  );
  const stop = async () => {
    await scheduler.stop();
    await worker?.drain(2_000);
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
