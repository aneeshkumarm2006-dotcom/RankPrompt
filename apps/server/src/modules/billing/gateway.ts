import Stripe from 'stripe';

/**
 * The Stripe API version every request uses (06 § Setup): pinned to the version stripe-node
 * 22.6.2 ships with, so an SDK upgrade can't silently change response shapes. Handlers read
 * objects only through this module's snapshots, and webhook payloads are never trusted (they are
 * re-fetched), so the webhook endpoint's own API version doesn't matter (D-025).
 */
export const STRIPE_API_VERSION = '2026-08-26.dahlia' as const;

/** The parts of a subscription the plan state is built from. */
export interface SubscriptionSnapshot {
  id: string;
  customerId: string;
  /** Stripe's raw status; `mapStripeStatus()` turns it into ours. */
  status: string;
  priceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** The price a subscription schedule switches to at period end (a scheduled downgrade). */
  pendingPriceId: string | null;
}

export interface InvoiceSnapshot {
  id: string;
  customerId: string | null;
  subscriptionId: string | null;
  billingReason: string | null;
  status: string | null;
}

export interface CheckoutSessionSnapshot {
  id: string;
  mode: string;
  paymentStatus: string;
  customerId: string | null;
  subscriptionId: string | null;
  priceIds: string[];
}

export interface CheckoutRequest {
  mode: 'subscription' | 'payment';
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  /** `{ workspaceId, … }`: a hint for people reading the dashboard; handlers look up by customer. */
  metadata: Record<string, string>;
}

/**
 * Everything the app asks of Stripe. The real one wraps the SDK; tests use an in-memory fake and
 * sign their webhook events with the SDK's own test-header helper.
 */
export interface BillingGateway {
  createCustomer(c: { workspaceId: string; email: string; name: string }): Promise<string>;
  createCheckoutSession(r: CheckoutRequest): Promise<{ id: string; url: string }>;
  createPortalSession(p: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  getSubscription(id: string): Promise<SubscriptionSnapshot>;
  getInvoice(id: string): Promise<InvoiceSnapshot>;
  getCheckoutSession(id: string): Promise<CheckoutSessionSnapshot>;
}

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  v == null ? null : typeof v === 'string' ? v : v.id;

const date = (seconds: number | null | undefined): Date | null =>
  seconds == null ? null : new Date(seconds * 1000);

/**
 * The subscription an invoice belongs to. Newer API versions moved it to
 * `invoice.parent.subscription_details.subscription`; older payloads had `invoice.subscription`.
 */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = idOf(invoice.parent?.subscription_details?.subscription);
  if (fromParent) return fromParent;
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  return idOf(legacy);
}

/** The next phase's price on a subscription schedule, if one starts after the current phase. */
function scheduledPriceId(schedule: Stripe.SubscriptionSchedule | null): string | null {
  if (!schedule || schedule.status === 'canceled' || schedule.status === 'released') return null;
  const currentEnd = schedule.current_phase?.end_date;
  if (currentEnd == null) return null;
  const next = schedule.phases.find((phase) => phase.start_date >= currentEnd);
  return idOf(next?.items[0]?.price ?? null);
}

export function subscriptionSnapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
  const item = sub.items.data[0];
  // Older API versions kept the period on the subscription itself.
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const schedule = typeof sub.schedule === 'object' ? sub.schedule : null;
  return {
    id: sub.id,
    customerId: idOf(sub.customer) ?? '',
    status: sub.status,
    priceId: item?.price.id ?? null,
    currentPeriodStart: date(item?.current_period_start ?? legacy.current_period_start),
    currentPeriodEnd: date(item?.current_period_end ?? legacy.current_period_end),
    // The portal's "cancel at period end" sets one of these, depending on the API version.
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at !== null,
    pendingPriceId: scheduledPriceId(schedule),
  };
}

export function invoiceSnapshot(invoice: Stripe.Invoice): InvoiceSnapshot {
  return {
    id: invoice.id ?? '',
    customerId: idOf(invoice.customer),
    subscriptionId: invoiceSubscriptionId(invoice),
    billingReason: invoice.billing_reason,
    status: invoice.status,
  };
}

export function checkoutSessionSnapshot(s: Stripe.Checkout.Session): CheckoutSessionSnapshot {
  return {
    id: s.id,
    mode: s.mode,
    paymentStatus: s.payment_status,
    customerId: idOf(s.customer),
    subscriptionId: idOf(s.subscription),
    priceIds: (s.line_items?.data ?? []).flatMap((li) => (li.price ? [li.price.id] : [])),
  };
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: 'PromptVerse' },
  });
}

export function createStripeGateway(
  secretKey: string,
  opts: { portalConfigurationId?: string | undefined } = {},
): BillingGateway {
  const stripe = createStripeClient(secretKey);
  return {
    async createCustomer(c) {
      const customer = await stripe.customers.create(
        { email: c.email, name: c.name, metadata: { workspaceId: c.workspaceId } },
        // Two checkouts racing for a workspace's first customer get the same one back.
        { idempotencyKey: `customer:${c.workspaceId}` },
      );
      return customer.id;
    },

    async createCheckoutSession(r) {
      const session = await stripe.checkout.sessions.create({
        mode: r.mode,
        customer: r.customerId,
        line_items: [{ price: r.priceId, quantity: 1 }],
        success_url: r.successUrl,
        cancel_url: r.cancelUrl,
        ...(r.metadata.workspaceId ? { client_reference_id: r.metadata.workspaceId } : {}),
        metadata: r.metadata,
        ...(r.mode === 'subscription'
          ? { subscription_data: { metadata: r.metadata } }
          : { payment_intent_data: { metadata: r.metadata } }),
      });
      if (!session.url) throw new Error(`checkout session ${session.id} has no url`);
      return { id: session.id, url: session.url };
    },

    async createPortalSession(p) {
      const session = await stripe.billingPortal.sessions.create({
        customer: p.customerId,
        return_url: p.returnUrl,
        ...(opts.portalConfigurationId ? { configuration: opts.portalConfigurationId } : {}),
      });
      return { url: session.url };
    },

    async getSubscription(id) {
      return subscriptionSnapshot(
        await stripe.subscriptions.retrieve(id, { expand: ['schedule'] }),
      );
    },

    async getInvoice(id) {
      return invoiceSnapshot(await stripe.invoices.retrieve(id));
    },

    async getCheckoutSession(id) {
      return checkoutSessionSnapshot(
        await stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] }),
      );
    },
  };
}

/** The verified event's id, type and object id. Throws when the signature doesn't match. */
export function verifyWebhookEvent(
  payload: Buffer,
  signature: string,
  secret: string,
): { id: string; type: string; objectId: string | null } {
  const event = Stripe.webhooks.constructEvent(payload, signature, secret);
  const object = event.data.object as { id?: unknown };
  return {
    id: event.id,
    type: event.type,
    objectId: typeof object.id === 'string' ? object.id : null,
  };
}
