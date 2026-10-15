import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import {
  invoiceSnapshot,
  subscriptionSnapshot,
  verifyWebhookEvent,
} from '../src/modules/billing/gateway';
import { priceBookFromEnv } from '../src/modules/billing/prices';
import { lifecycleOf, mapStripeStatus } from '../src/modules/billing/sync';
import { BILLING_ENV, WEBHOOK_SECRET, signedEvent } from './fakeStripe';

/** The pure parts of the Stripe integration: snapshots, status mapping, prices, signatures. */

const asSub = (o: unknown) => o as Stripe.Subscription;
const asInvoice = (o: unknown) => o as Stripe.Invoice;

const baseSub = {
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  cancel_at: null,
  schedule: null,
  items: {
    data: [
      {
        price: { id: 'price_pro' },
        current_period_start: 1_790_000_000,
        current_period_end: 1_792_600_000,
      },
    ],
  },
};

describe('subscriptionSnapshot', () => {
  it('reads the period from the item (current API) or the subscription (older versions)', () => {
    expect(subscriptionSnapshot(asSub(baseSub))).toEqual({
      id: 'sub_1',
      customerId: 'cus_1',
      status: 'active',
      priceId: 'price_pro',
      currentPeriodStart: new Date(1_790_000_000_000),
      currentPeriodEnd: new Date(1_792_600_000_000),
      cancelAtPeriodEnd: false,
      pendingPriceId: null,
    });
    const legacy = {
      ...baseSub,
      customer: { id: 'cus_2' },
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_600_000,
      items: { data: [{ price: { id: 'price_pro' } }] },
    };
    expect(subscriptionSnapshot(asSub(legacy))).toMatchObject({
      customerId: 'cus_2',
      currentPeriodStart: new Date(1_700_000_000_000),
    });
  });

  it('treats cancel_at as cancel-at-period-end', () => {
    expect(
      subscriptionSnapshot(asSub({ ...baseSub, cancel_at: 1_792_600_000 })).cancelAtPeriodEnd,
    ).toBe(true);
    expect(
      subscriptionSnapshot(asSub({ ...baseSub, cancel_at_period_end: true })).cancelAtPeriodEnd,
    ).toBe(true);
  });

  it("takes a scheduled downgrade's price from the schedule's next phase", () => {
    const schedule = {
      status: 'active',
      current_phase: { start_date: 1_790_000_000, end_date: 1_792_600_000 },
      phases: [
        { start_date: 1_790_000_000, items: [{ price: 'price_pro' }] },
        { start_date: 1_792_600_000, items: [{ price: { id: 'price_starter' } }] },
      ],
    };
    expect(subscriptionSnapshot(asSub({ ...baseSub, schedule })).pendingPriceId).toBe(
      'price_starter',
    );
    expect(
      subscriptionSnapshot(asSub({ ...baseSub, schedule: { ...schedule, status: 'released' } }))
        .pendingPriceId,
    ).toBeNull();
    // Not expanded: just an id, so nothing is known about the next phase.
    expect(
      subscriptionSnapshot(asSub({ ...baseSub, schedule: 'sub_sched_1' })).pendingPriceId,
    ).toBeNull();
  });
});

describe('invoiceSnapshot', () => {
  it('finds the subscription under parent.subscription_details, or the legacy field', () => {
    const current = {
      id: 'in_1',
      customer: 'cus_1',
      billing_reason: 'subscription_cycle',
      status: 'paid',
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1' } },
    };
    expect(invoiceSnapshot(asInvoice(current))).toEqual({
      id: 'in_1',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      billingReason: 'subscription_cycle',
      status: 'paid',
    });
    const legacy = { ...current, parent: null, subscription: { id: 'sub_9' } };
    expect(invoiceSnapshot(asInvoice(legacy)).subscriptionId).toBe('sub_9');
    const oneOff = { ...current, parent: null, billing_reason: 'manual' };
    expect(invoiceSnapshot(asInvoice(oneOff)).subscriptionId).toBeNull();
  });
});

describe('mapStripeStatus', () => {
  it('maps every Stripe status onto ours explicitly', () => {
    const cases: [string, string, string][] = [
      ['active', 'active', 'live'],
      ['trialing', 'active', 'live'],
      ['past_due', 'past_due', 'live'],
      ['unpaid', 'past_due', 'live'],
      ['paused', 'past_due', 'live'],
      ['canceled', 'canceled', 'ended'],
      ['incomplete_expired', 'canceled', 'ended'],
      ['incomplete', 'none', 'pending'],
      ['something_new', 'none', 'pending'],
    ];
    for (const [stripe, ours, lifecycle] of cases) {
      expect(mapStripeStatus(stripe), stripe).toBe(ours);
      expect(lifecycleOf(stripe), stripe).toBe(lifecycle);
    }
  });
});

describe('price book', () => {
  it('maps price ids both ways and skips unset ones', () => {
    const prices = priceBookFromEnv({ ...BILLING_ENV, STRIPE_PRICE_AGENCY: undefined });
    expect(prices.forTier('pro')).toBe('price_pro');
    expect(prices.tierOf('price_starter')).toBe('starter');
    expect(prices.tierOf('price_topup_50')).toBeNull();
    expect(prices.packOf('price_topup_200')).toBe('topup_200');
    expect(prices.forTier('agency')).toBeUndefined();
    expect(prices.tierPrices().map((p) => p.tier)).toEqual(['starter', 'pro']);
  });
});

describe('verifyWebhookEvent', () => {
  it('accepts a correctly signed payload and rejects anything else', () => {
    const event = signedEvent('invoice.paid', 'in_1');
    expect(verifyWebhookEvent(Buffer.from(event.payload), event.signature, WEBHOOK_SECRET)).toEqual(
      {
        id: event.id,
        type: 'invoice.paid',
        objectId: 'in_1',
      },
    );
    expect(() =>
      verifyWebhookEvent(Buffer.from(event.payload), event.signature, 'whsec_wrong'),
    ).toThrow();
    const old = Stripe.webhooks.generateTestHeaderString({
      payload: event.payload,
      secret: WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    // Older than the SDK's 5-minute tolerance: a replayed capture is refused.
    expect(() => verifyWebhookEvent(Buffer.from(event.payload), old, WEBHOOK_SECRET)).toThrow();
  });
});
