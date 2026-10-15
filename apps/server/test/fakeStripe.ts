import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import Stripe from 'stripe';
import request from 'supertest';
import {
  STRIPE_API_VERSION,
  type BillingGateway,
  type CheckoutRequest,
  type CheckoutSessionSnapshot,
  type InvoiceSnapshot,
  type SubscriptionSnapshot,
} from '../src/modules/billing/gateway';

export const WEBHOOK_SECRET = 'whsec_test_secret';

/** The env a billing test app needs: test-mode-looking price ids and the webhook secret. */
export const BILLING_ENV = {
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_STARTER: 'price_starter',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_AGENCY: 'price_agency',
  STRIPE_PRICE_TOPUP_50: 'price_topup_50',
  STRIPE_PRICE_TOPUP_100: 'price_topup_100',
  STRIPE_PRICE_TOPUP_200: 'price_topup_200',
};

const DAY = 24 * 60 * 60_000;
export const PERIOD_1 = new Date('2026-10-01T00:00:00Z');
export const PERIOD_2 = new Date(PERIOD_1.getTime() + 31 * DAY);
export const PERIOD_3 = new Date(PERIOD_2.getTime() + 30 * DAY);

type StoredSession = CheckoutSessionSnapshot & { request: CheckoutRequest };

/**
 * An in-memory Stripe for tests. The app's calls (customers, checkout, portal, retrieves) work on
 * it, and the test plays Stripe's part by changing its objects and then delivering signed events
 * that point at them, the way the real webhook does.
 */
export class FakeStripe implements BillingGateway {
  readonly customers = new Map<string, { workspaceId: string; email: string }>();
  readonly sessions = new Map<string, StoredSession>();
  readonly subscriptions = new Map<string, SubscriptionSnapshot>();
  readonly invoices = new Map<string, InvoiceSnapshot>();
  /** Set to make the next `get*` call throw once (a Stripe outage). */
  failNextRetrieve = false;
  private n = 0;

  private next(prefix: string): string {
    this.n += 1;
    return `${prefix}_${this.n}`;
  }

  // ---- What the app calls --------------------------------------------------------------

  createCustomer(c: { workspaceId: string; email: string }): Promise<string> {
    // Like the real idempotency key: one customer per workspace however often it's asked.
    for (const [id, existing] of this.customers) {
      if (existing.workspaceId === c.workspaceId) return Promise.resolve(id);
    }
    const id = this.next('cus');
    this.customers.set(id, { workspaceId: c.workspaceId, email: c.email });
    return Promise.resolve(id);
  }

  createCheckoutSession(r: CheckoutRequest): Promise<{ id: string; url: string }> {
    const id = this.next('cs');
    this.sessions.set(id, {
      id,
      mode: r.mode,
      paymentStatus: 'unpaid',
      customerId: r.customerId,
      subscriptionId: null,
      priceIds: [r.priceId],
      request: r,
    });
    return Promise.resolve({ id, url: `https://checkout.stripe.test/${id}` });
  }

  createPortalSession(p: { customerId: string }): Promise<{ url: string }> {
    return Promise.resolve({ url: `https://billing.stripe.test/${p.customerId}` });
  }

  getSubscription(id: string): Promise<SubscriptionSnapshot> {
    return this.read(this.subscriptions, id);
  }

  getInvoice(id: string): Promise<InvoiceSnapshot> {
    return this.read(this.invoices, id);
  }

  getCheckoutSession(id: string): Promise<CheckoutSessionSnapshot> {
    return this.read(this.sessions, id).then(({ request: _r, ...snapshot }) => snapshot);
  }

  private read<T>(map: Map<string, T>, id: string): Promise<T> {
    if (this.failNextRetrieve) {
      this.failNextRetrieve = false;
      return Promise.reject(new Error('stripe is down'));
    }
    const value = map.get(id);
    if (!value) return Promise.reject(new Error(`No such object: ${id}`));
    return Promise.resolve(structuredClone(value));
  }

  // ---- Playing Stripe's part -----------------------------------------------------------

  /** The customer completes a subscription checkout: an active subscription and its invoice. */
  completeSubscriptionCheckout(
    sessionId: string,
    periodStart: Date = PERIOD_1,
  ): { subscriptionId: string; invoiceId: string } {
    const session = this.mustGet(this.sessions, sessionId);
    const subscriptionId = this.next('sub');
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      customerId: session.customerId ?? '',
      status: 'active',
      priceId: session.request.priceId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: new Date(periodStart.getTime() + 31 * DAY),
      cancelAtPeriodEnd: false,
      pendingPriceId: null,
    });
    Object.assign(session, { paymentStatus: 'paid', subscriptionId });
    const invoiceId = this.addInvoice(subscriptionId, 'subscription_create', 'paid');
    return { subscriptionId, invoiceId };
  }

  /** The customer pays a top-up checkout (or not yet, for an async payment method). */
  completePaymentCheckout(sessionId: string, paid = true): void {
    Object.assign(this.mustGet(this.sessions, sessionId), {
      paymentStatus: paid ? 'paid' : 'unpaid',
    });
  }

  updateSubscription(id: string, patch: Partial<SubscriptionSnapshot>): void {
    Object.assign(this.mustGet(this.subscriptions, id), patch);
  }

  /** A new billing period starts (renewal, or a scheduled downgrade taking effect). */
  renew(id: string, periodStart: Date, patch: Partial<SubscriptionSnapshot> = {}): void {
    this.updateSubscription(id, {
      currentPeriodStart: periodStart,
      currentPeriodEnd: new Date(periodStart.getTime() + 30 * DAY),
      ...patch,
    });
  }

  addInvoice(
    subscriptionId: string | null,
    billingReason: string,
    status: 'paid' | 'open' = 'paid',
  ): string {
    const id = this.next('in');
    const customerId = subscriptionId
      ? this.mustGet(this.subscriptions, subscriptionId).customerId
      : null;
    this.invoices.set(id, { id, customerId, subscriptionId, billingReason, status });
    return id;
  }

  setInvoiceStatus(id: string, status: 'paid' | 'open'): void {
    Object.assign(this.mustGet(this.invoices, id), { status });
  }

  private mustGet<T>(map: Map<string, T>, id: string): T {
    const value = map.get(id);
    if (!value) throw new Error(`fake stripe has no ${id}`);
    return value;
  }
}

export interface SignedEvent {
  id: string;
  type: string;
  payload: string;
  signature: string;
}

/**
 * A Stripe event signed with the webhook secret by the SDK's own helper, so the app verifies it
 * exactly as it would a real delivery. Pass `id` to redeliver the same event.
 */
export function signedEvent(
  type: string,
  objectId: string,
  opts: { id?: string; secret?: string; extra?: Record<string, unknown> } = {},
): SignedEvent {
  const id = opts.id ?? `evt_${randomUUID().replace(/-/g, '')}`;
  const payload = JSON.stringify({
    id,
    object: 'event',
    api_version: STRIPE_API_VERSION,
    created: Math.floor(Date.now() / 1000),
    type,
    // A deliberately thin payload: the handlers must re-fetch, never read it.
    data: { object: { id: objectId, ...opts.extra } },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: opts.secret ?? WEBHOOK_SECRET,
  });
  return { id, type, payload, signature };
}

export function deliver(app: Express, event: SignedEvent) {
  return request(app)
    .post('/api/stripe/webhook')
    .set('stripe-signature', event.signature)
    .set('content-type', 'application/json')
    .send(event.payload);
}
