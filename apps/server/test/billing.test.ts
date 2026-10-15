import { errorEnvelopeSchema, redirectUrlSchema, subscriptionSchema } from '@pv/shared';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTransaction } from '../src/db/transaction';
import { LedgerModel } from '../src/modules/credits/model';
import { adminAdjust, ledgerMatchesBalance } from '../src/modules/credits/service';
import { stripeEventsRepo } from '../src/modules/stripeEvents/repo';
import { workspacesRepo } from '../src/modules/workspaces/repo';
import {
  BILLING_ENV,
  FakeStripe,
  PERIOD_1,
  PERIOD_2,
  PERIOD_3,
  deliver,
  signedEvent,
  type SignedEvent,
} from './fakeStripe';
import {
  client,
  connectTestDb,
  deliverEmails,
  dropTestDb,
  makeTestApp,
  signUp,
  type Client,
  type TestApp,
} from './helpers';

/**
 * Stage 6 billing (06, TODO 6.2, 6.3, 6.6). The webhook scenarios replay the 06 test matrix with
 * signed test events against an in-memory Stripe; after each, the ledger must equal the balance.
 */

const stripe = new FakeStripe();
const t: TestApp = makeTestApp({ env: BILLING_ENV, billing: stripe });
const { app, mailer } = t;

beforeAll(() => connectTestDb('billing_test'));
afterAll(() => dropTestDb());

async function verifiedUser(): Promise<{ agent: Client; workspaceId: string; email: string }> {
  const { agent, me, email } = await signUp(app);
  const token = await mailer.tokenFor(email, 'verify_email');
  await client(app).post('/api/auth/verify-email').send({ token }).expect(204);
  return { agent, workspaceId: me.workspace.id, email };
}

const sessionIdOf = (url: string) => url.split('/').at(-1) ?? '';

async function checkout(agent: Client, tier: 'starter' | 'pro' | 'agency'): Promise<string> {
  const res = await agent.post('/api/billing/checkout').send({ tier }).expect(200);
  return sessionIdOf(redirectUrlSchema.parse(res.body).url);
}

async function send(event: SignedEvent, status = 200) {
  const res = await deliver(app, event);
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  return res;
}

async function workspace(id: string) {
  const ws = await workspacesRepo.findById(id);
  if (!ws) throw new Error('workspace missing');
  return ws;
}

async function expectReconciled(workspaceId: string) {
  const check = await ledgerMatchesBalance(new Types.ObjectId(workspaceId));
  expect(check.ok, JSON.stringify(check)).toBe(true);
  return check.balance;
}

const ledgerRows = (workspaceId: string, reason?: string) =>
  LedgerModel.find({ workspaceId: new Types.ObjectId(workspaceId), ...(reason ? { reason } : {}) })
    .sort({ _id: 1 })
    .lean()
    .exec();

/** Spends plan credits the way a run would (an admin row is enough for the ledger maths). */
const spendPlan = (workspaceId: string, amount: number) =>
  withTransaction((session) =>
    adminAdjust(session, {
      workspaceId: new Types.ObjectId(workspaceId),
      bucket: 'plan',
      delta: -amount,
      note: 'test spend',
    }),
  );

/** Subscribes a fresh verified user to `tier` and delivers checkout + first invoice. */
async function subscribed(tier: 'starter' | 'pro' = 'starter') {
  const user = await verifiedUser();
  const sessionId = await checkout(user.agent, tier);
  const { subscriptionId, invoiceId } = stripe.completeSubscriptionCheckout(sessionId);
  const events = {
    checkout: signedEvent('checkout.session.completed', sessionId),
    created: signedEvent('customer.subscription.created', subscriptionId),
    paid: signedEvent('invoice.paid', invoiceId),
  };
  await send(events.checkout);
  await send(events.created);
  await send(events.paid);
  return { ...user, sessionId, subscriptionId, invoiceId, events };
}

// ---- Endpoints ------------------------------------------------------------------------------

describe('billing endpoints (6.2)', () => {
  it('GET /billing/subscription returns the workspace plan state', async () => {
    const { agent } = await signUp(app);
    const res = await agent.get('/api/billing/subscription').expect(200);
    expect(subscriptionSchema.parse(res.body)).toEqual({
      tier: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      pendingTier: null,
    });
  });

  it('buying needs a verified email', async () => {
    const { agent } = await signUp(app);
    for (const [path, body] of [
      ['/api/billing/checkout', { tier: 'starter' }],
      ['/api/billing/topup', { pack: 'topup_50' }],
    ] as const) {
      const res = await agent.post(path).send(body).expect(403);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('EMAIL_NOT_VERIFIED');
    }
  });

  it('checkout creates one Stripe customer per workspace, even when two run at once', async () => {
    const { agent, workspaceId } = await verifiedUser();
    const [a, b] = await Promise.all([checkout(agent, 'starter'), checkout(agent, 'pro')]);
    const ws = await workspace(workspaceId);
    expect(ws.stripe.customerId).toMatch(/^cus_/);
    expect(stripe.sessions.get(a)?.customerId).toBe(ws.stripe.customerId);
    expect(stripe.sessions.get(b)?.customerId).toBe(ws.stripe.customerId);
    const session = stripe.sessions.get(a);
    expect(session?.request).toMatchObject({
      mode: 'subscription',
      priceId: 'price_starter',
      metadata: { workspaceId, tier: 'starter' },
    });
    expect(session?.request.successUrl).toBe(
      'http://localhost:5173/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    );
    expect(session?.request.cancelUrl).toBe('http://localhost:5173/app/billing?checkout=cancel');
  });

  it('top-up opens a payment-mode session for the pack price', async () => {
    const { agent, workspaceId } = await verifiedUser();
    const res = await agent.post('/api/billing/topup').send({ pack: 'topup_100' }).expect(200);
    const session = stripe.sessions.get(sessionIdOf(redirectUrlSchema.parse(res.body).url));
    expect(session?.request).toMatchObject({
      mode: 'payment',
      priceId: 'price_topup_100',
      metadata: { workspaceId, pack: 'topup_100' },
    });
    await agent.post('/api/billing/topup').send({ pack: 'topup_7' }).expect(400);
  });

  it('portal needs a billing account first, then opens for the workspace customer', async () => {
    const { agent } = await verifiedUser();
    const none = await agent.post('/api/billing/portal').expect(409);
    expect(errorEnvelopeSchema.parse(none.body).error.code).toBe('CONFLICT');
    await checkout(agent, 'starter');
    const res = await agent.post('/api/billing/portal').expect(200);
    expect(redirectUrlSchema.parse(res.body).url).toMatch(/^https:\/\/billing\.stripe\.test\/cus_/);
  });

  it('checkout is refused while a subscription is live; the portal changes plans instead', async () => {
    const { agent } = await subscribed('starter');
    const res = await agent.post('/api/billing/checkout').send({ tier: 'pro' }).expect(409);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('SUBSCRIPTION_EXISTS');
    // Top-ups are fine during a subscription.
    await agent.post('/api/billing/topup').send({ pack: 'topup_50' }).expect(200);
  });

  it('answers 503 when Stripe is not configured', async () => {
    const bare = makeTestApp();
    const { agent, email } = await signUp(bare.app);
    const token = await bare.mailer.tokenFor(email, 'verify_email');
    await client(bare.app).post('/api/auth/verify-email').send({ token }).expect(204);
    const res = await agent.post('/api/billing/checkout').send({ tier: 'starter' }).expect(503);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('UPSTREAM_UNAVAILABLE');
    await agent.get('/api/billing/subscription').expect(200);
    const hook = await deliver(bare.app, signedEvent('invoice.paid', 'in_x'));
    expect(hook.status).toBe(503);
  });
});

// ---- Webhook mechanics ----------------------------------------------------------------------

describe('POST /api/stripe/webhook (6.3)', () => {
  it('rejects a missing or wrong signature, without needing an Origin header', async () => {
    const event = signedEvent('invoice.paid', 'in_x');
    await deliver(app, { ...event, signature: 't=1,v1=bad' }).expect(400);
    await deliver(app, signedEvent('invoice.paid', 'in_x', { secret: 'whsec_other' })).expect(400);
    // A tampered body no longer matches its signature.
    await deliver(app, { ...event, payload: event.payload.replace('in_x', 'in_y') }).expect(400);
  });

  it('acknowledges event types it does not handle', async () => {
    const res = await send(signedEvent('charge.refunded', 'ch_1'));
    expect(res.body).toMatchObject({ ignored: true });
  });

  it('ignores events for customers it does not know (v1 or dashboard customers)', async () => {
    const subscriptionId = 'sub_foreign';
    stripe.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      customerId: 'cus_foreign',
      status: 'active',
      priceId: 'price_starter',
      currentPeriodStart: PERIOD_1,
      currentPeriodEnd: PERIOD_2,
      cancelAtPeriodEnd: false,
      pendingPriceId: null,
    });
    await send(signedEvent('customer.subscription.updated', subscriptionId));
  });

  it('a failing handler answers 500 and marks the event failed; the retry then succeeds', async () => {
    const { workspaceId, subscriptionId } = await subscribed('starter');
    stripe.renew(subscriptionId, PERIOD_2);
    const invoiceId = stripe.addInvoice(subscriptionId, 'subscription_cycle');
    const event = signedEvent('invoice.paid', invoiceId);

    stripe.failNextRetrieve = true;
    await send(event, 500);
    expect(await stripeEventsRepo.findByEventId(event.id)).toMatchObject({
      status: 'failed',
      attempts: 1,
    });
    expect((await workspace(workspaceId)).credits.plan).toBe(150);

    await spendPlan(workspaceId, 40);
    await send(event);
    expect(await stripeEventsRepo.findByEventId(event.id)).toMatchObject({
      status: 'done',
      attempts: 2,
    });
    expect((await workspace(workspaceId)).credits.plan).toBe(150);
    await expectReconciled(workspaceId);
  });

  it('a subscription price missing from env fails the event instead of guessing a tier', async () => {
    const { subscriptionId } = await subscribed('starter');
    stripe.updateSubscription(subscriptionId, { priceId: 'price_legacy' });
    await send(signedEvent('customer.subscription.updated', subscriptionId), 500);
  });

  it('two deliveries of one event at the same moment apply it once', async () => {
    const user = await verifiedUser();
    const res = await user.agent.post('/api/billing/topup').send({ pack: 'topup_200' }).expect(200);
    const sessionId = sessionIdOf(redirectUrlSchema.parse(res.body).url);
    stripe.completePaymentCheckout(sessionId);
    const event = signedEvent('checkout.session.completed', sessionId);
    const replies = await Promise.all([
      deliver(app, event),
      deliver(app, event),
      deliver(app, event),
    ]);
    for (const r of replies) expect([200, 409]).toContain(r.status);
    expect((await workspace(user.workspaceId)).credits.purchased).toBe(50 + 200);
    expect(await ledgerRows(user.workspaceId, 'topup')).toHaveLength(1);
    // Once the winner is done, a redelivery is a plain 200.
    await send(event);
    await expectReconciled(user.workspaceId);
  });

  it('a claim left processing by a dead instance is taken over after the stale window', async () => {
    const event = { id: `evt_stale_${Date.now()}`, type: 'invoice.paid' };
    expect(await stripeEventsRepo.claim(event, 60_000, new Date('2026-10-01T00:00:00Z'))).toBe(
      'claimed',
    );
    expect(await stripeEventsRepo.claim(event, 60_000, new Date('2026-10-01T00:00:30Z'))).toBe(
      'in_progress',
    );
    expect(await stripeEventsRepo.claim(event, 60_000, new Date('2026-10-01T00:02:00Z'))).toBe(
      'claimed',
    );
    await stripeEventsRepo.markDone(event.id);
    expect(await stripeEventsRepo.claim(event, 60_000)).toBe('done');
  });
});

// ---- The 06 test matrix (6.6) ---------------------------------------------------------------

describe('06 test matrix: replayed with signed test events (6.6)', () => {
  it('subscribe: plan state synced at checkout, plan credits granted by invoice.paid', async () => {
    const { workspaceId, subscriptionId, invoiceId } = await subscribed('starter');
    const ws = await workspace(workspaceId);
    expect(ws.plan).toMatchObject({ tier: 'starter', status: 'active', cancelAtPeriodEnd: false });
    expect(ws.stripe).toMatchObject({ subscriptionId, priceId: 'price_starter' });
    expect(ws.credits).toEqual({ plan: 150, purchased: 50 });
    const grants = await ledgerRows(workspaceId, 'plan_grant');
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ refType: 'stripe_invoice', refId: invoiceId, delta: 150 });
    await expectReconciled(workspaceId);
  });

  it('duplicate delivery of every event changes nothing', async () => {
    const { workspaceId, events, invoiceId } = await subscribed('pro');
    const before = await ledgerRows(workspaceId);
    for (const event of Object.values(events)) {
      const res = await send(event);
      expect(res.body).toMatchObject({ duplicate: true });
    }
    // v1's endpoint also sends invoice.payment_succeeded for the same invoice: a new event id,
    // same invoice, so the invoice-keyed rows make it a no-op.
    await send(signedEvent('invoice.payment_succeeded', invoiceId));
    expect(await ledgerRows(workspaceId)).toHaveLength(before.length);
    expect((await workspace(workspaceId)).credits).toEqual({ plan: 500, purchased: 50 });
    await expectReconciled(workspaceId);
  });

  it('out of order: subscription.updated and invoice.paid before checkout.session.completed', async () => {
    const user = await verifiedUser();
    const sessionId = await checkout(user.agent, 'starter');
    const { subscriptionId, invoiceId } = stripe.completeSubscriptionCheckout(sessionId);
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    await send(signedEvent('invoice.paid', invoiceId));
    await send(signedEvent('checkout.session.completed', sessionId));
    await send(signedEvent('customer.subscription.created', subscriptionId));
    const ws = await workspace(user.workspaceId);
    expect(ws.plan).toMatchObject({ tier: 'starter', status: 'active' });
    expect(ws.credits).toEqual({ plan: 150, purchased: 50 });
    await expectReconciled(user.workspaceId);
  });

  it('failed payment, then recovery: past_due + email, then active with fresh plan credits', async () => {
    const { workspaceId, subscriptionId, email } = await subscribed('starter');
    await spendPlan(workspaceId, 100);

    stripe.renew(subscriptionId, PERIOD_2, { status: 'past_due' });
    const invoiceId = stripe.addInvoice(subscriptionId, 'subscription_cycle', 'open');
    const sentBefore = mailer.sent.length;
    await send(signedEvent('invoice.payment_failed', invoiceId));
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    let ws = await workspace(workspaceId);
    expect(ws.plan.status).toBe('past_due');
    // Runs stay allowed while plan credits remain; nothing is granted for an unpaid invoice.
    expect(ws.credits.plan).toBe(50);
    await mailer.waitFor('payment_failed', 1, email);
    const emails = mailer.sent.slice(sentBefore).filter((m) => m.template === 'payment_failed');
    expect(emails).toHaveLength(1);
    expect(emails[0]?.to).toBe(email);
    await expectReconciled(workspaceId);

    // Stripe's retry succeeds.
    stripe.updateSubscription(subscriptionId, { status: 'active' });
    stripe.setInvoiceStatus(invoiceId, 'paid');
    await send(signedEvent('invoice.paid', invoiceId));
    // The failure event redelivered late must not flip it back or email again.
    await send(signedEvent('invoice.payment_failed', invoiceId));
    ws = await workspace(workspaceId);
    expect(ws.plan.status).toBe('active');
    expect(ws.credits.plan).toBe(150);
    expect(await ledgerRows(workspaceId, 'plan_reset')).toHaveLength(1);
    await deliverEmails(mailer);
    expect(mailer.sent.filter((m) => m.template === 'payment_failed')).toHaveLength(1);
    await expectReconciled(workspaceId);
  });

  it('upgrade mid-cycle: plan credits topped up to the new allowance, never lowered', async () => {
    const { workspaceId, subscriptionId } = await subscribed('starter');
    await spendPlan(workspaceId, 100); // 50 left

    stripe.updateSubscription(subscriptionId, { priceId: 'price_pro' });
    const proration = stripe.addInvoice(subscriptionId, 'subscription_update');
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    await send(signedEvent('invoice.paid', proration));
    let ws = await workspace(workspaceId);
    expect(ws.plan.tier).toBe('pro');
    expect(ws.credits.plan).toBe(500);
    await expectReconciled(workspaceId);

    // Spending, then a replayed or late invoice in the same period, changes nothing.
    await spendPlan(workspaceId, 200);
    await send(signedEvent('invoice.payment_succeeded', proration));
    // Another invoice in the same period at the same tier (say, a payment-method retry
    // invoice) doesn't refill either.
    await send(
      signedEvent('invoice.paid', stripe.addInvoice(subscriptionId, 'subscription_update')),
    );
    ws = await workspace(workspaceId);
    expect(ws.credits.plan).toBe(300);

    // The next cycle resets to the pro allowance.
    stripe.renew(subscriptionId, PERIOD_2);
    await send(
      signedEvent('invoice.paid', stripe.addInvoice(subscriptionId, 'subscription_cycle')),
    );
    expect((await workspace(workspaceId)).credits.plan).toBe(500);
    await expectReconciled(workspaceId);
  });

  it('downgrade at period end: pendingTier until then, then the lower allowance', async () => {
    const { workspaceId, subscriptionId } = await subscribed('pro');
    stripe.updateSubscription(subscriptionId, { pendingPriceId: 'price_starter' });
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    let ws = await workspace(workspaceId);
    expect(ws.plan).toMatchObject({ tier: 'pro', pendingTier: 'starter' });
    expect(ws.credits.plan).toBe(500);

    // The schedule's next phase starts with the new period. Whatever billing_reason Stripe
    // gives that invoice, a newer period means a reset.
    stripe.renew(subscriptionId, PERIOD_2, { priceId: 'price_starter', pendingPriceId: null });
    await send(
      signedEvent('invoice.paid', stripe.addInvoice(subscriptionId, 'subscription_update')),
    );
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    ws = await workspace(workspaceId);
    expect(ws.plan).toMatchObject({ tier: 'starter', pendingTier: null });
    expect(ws.credits.plan).toBe(150);
    await expectReconciled(workspaceId);
  });

  it('cancel at period end, then the period ends: free tier, plan credits 0, purchased kept', async () => {
    const { workspaceId, subscriptionId, invoiceId, agent } = await subscribed('starter');
    stripe.updateSubscription(subscriptionId, { cancelAtPeriodEnd: true });
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    let ws = await workspace(workspaceId);
    expect(ws.plan).toMatchObject({ tier: 'starter', status: 'active', cancelAtPeriodEnd: true });

    stripe.updateSubscription(subscriptionId, { status: 'canceled' });
    const deleted = signedEvent('customer.subscription.deleted', subscriptionId);
    await send(deleted);
    ws = await workspace(workspaceId);
    expect(ws.plan).toEqual({
      tier: 'free',
      status: 'canceled',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      pendingTier: null,
    });
    expect(ws.stripe.subscriptionId).toBeNull();
    expect(ws.credits).toEqual({ plan: 0, purchased: 50 });
    const end = await ledgerRows(workspaceId, 'plan_reset');
    expect(end.at(-1)).toMatchObject({ refType: 'stripe_sub_end', refId: subscriptionId });

    // Replays and stragglers for the ended subscription grant nothing.
    await send(deleted);
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    await send(signedEvent('invoice.payment_succeeded', invoiceId));
    expect((await workspace(workspaceId)).credits).toEqual({ plan: 0, purchased: 50 });
    await expectReconciled(workspaceId);

    // The workspace can subscribe again, and an old subscription can't undo the new one.
    const again = await checkout(agent, 'pro');
    const next = stripe.completeSubscriptionCheckout(again, PERIOD_3);
    await send(signedEvent('checkout.session.completed', again));
    await send(signedEvent('invoice.paid', next.invoiceId));
    await send(signedEvent('customer.subscription.deleted', subscriptionId));
    ws = await workspace(workspaceId);
    expect(ws.plan).toMatchObject({ tier: 'pro', status: 'active' });
    expect(ws.credits.plan).toBe(500);
    await expectReconciled(workspaceId);
  });

  it('a subscription that ends while unpaid (canceled after retries) ends the plan too', async () => {
    const { workspaceId, subscriptionId } = await subscribed('starter');
    stripe.updateSubscription(subscriptionId, { status: 'canceled' });
    // Only an updated event arrives first: the re-fetched state says it's over.
    await send(signedEvent('customer.subscription.updated', subscriptionId));
    expect((await workspace(workspaceId)).plan.tier).toBe('free');
    expect((await workspace(workspaceId)).credits.plan).toBe(0);
    await send(signedEvent('customer.subscription.deleted', subscriptionId));
    await expectReconciled(workspaceId);
  });

  it('top-up during an active subscription: purchased credits only, once', async () => {
    const { workspaceId, agent } = await subscribed('starter');
    const res = await agent.post('/api/billing/topup').send({ pack: 'topup_100' }).expect(200);
    const sessionId = sessionIdOf(redirectUrlSchema.parse(res.body).url);
    stripe.completePaymentCheckout(sessionId);
    const event = signedEvent('checkout.session.completed', sessionId);
    await send(event);
    await send(event);
    await send(signedEvent('checkout.session.completed', sessionId)); // a new event id, same session
    const ws = await workspace(workspaceId);
    expect(ws.credits).toEqual({ plan: 150, purchased: 150 });
    expect(ws.plan.tier).toBe('starter');
    const topups = await ledgerRows(workspaceId, 'topup');
    expect(topups).toHaveLength(1);
    expect(topups[0]).toMatchObject({ refType: 'stripe_session', refId: sessionId });
    await expectReconciled(workspaceId);
  });

  it('an async top-up is granted only when the payment succeeds', async () => {
    const { agent, workspaceId } = await verifiedUser();
    const res = await agent.post('/api/billing/topup').send({ pack: 'topup_50' }).expect(200);
    const sessionId = sessionIdOf(redirectUrlSchema.parse(res.body).url);
    stripe.completePaymentCheckout(sessionId, false);
    await send(signedEvent('checkout.session.completed', sessionId));
    expect((await workspace(workspaceId)).credits.purchased).toBe(50);
    stripe.completePaymentCheckout(sessionId, true);
    await send(signedEvent('checkout.session.async_payment_succeeded', sessionId));
    expect((await workspace(workspaceId)).credits.purchased).toBe(100);
    await expectReconciled(workspaceId);
  });

  it('refund of a top-up: a manual admin adjust, and the ledger still reconciles', async () => {
    const { agent, workspaceId } = await verifiedUser();
    const res = await agent.post('/api/billing/topup').send({ pack: 'topup_50' }).expect(200);
    const sessionId = sessionIdOf(redirectUrlSchema.parse(res.body).url);
    stripe.completePaymentCheckout(sessionId);
    await send(signedEvent('checkout.session.completed', sessionId));
    // The refund itself is done in the Stripe dashboard; `charge.refunded` is not handled.
    await send(signedEvent('charge.refunded', 'ch_refund'));
    await withTransaction((session) =>
      adminAdjust(session, {
        workspaceId: new Types.ObjectId(workspaceId),
        bucket: 'purchased',
        delta: -50,
        note: `Refund of top-up ${sessionId}`,
      }),
    );
    expect((await workspace(workspaceId)).credits.purchased).toBe(50);
    await expectReconciled(workspaceId);
  });
});
