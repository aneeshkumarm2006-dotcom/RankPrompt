import type { Logger } from '../../config/logger';
import type { ErrorReporter } from '../../config/sentry';
import { stripeEventsRepo } from '../stripeEvents/repo';
import { verifyWebhookEvent } from './gateway';
import type { BillingSync, SyncResult } from './sync';

/** A `processing` claim older than this is taken over: the instance holding it probably died. */
export const STALE_CLAIM_MS = 5 * 60_000;

export interface WebhookReply {
  status: number;
  body: Record<string, unknown>;
}

/** Event type → handler. Anything else is acknowledged and ignored. */
function route(
  sync: BillingSync,
  type: string,
  objectId: string,
): (() => Promise<SyncResult>) | null {
  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return () => sync.checkoutCompleted(objectId);
    // v1's endpoint subscribes to `invoice.payment_succeeded`; both mean the same paid invoice,
    // and the invoice-keyed ledger rows make the second one a no-op.
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return () => sync.invoicePaid(objectId);
    case 'invoice.payment_failed':
      return () => sync.invoicePaymentFailed(objectId);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return () => sync.subscriptionChanged(objectId);
    default:
      return null;
  }
}

/**
 * `POST /api/stripe/webhook` (06 § Webhook processing):
 * 1. verify the signature over the raw body (400 if it doesn't match);
 * 2. claim the event in `stripe_events`: a handled one answers 200 at once, one another delivery
 *    is still working on answers 409 so Stripe retries it later (D-025), a failed or stale one is
 *    taken over;
 * 3. handle it (handlers re-fetch from Stripe, never trusting the payload or its order);
 * 4. mark it done → 200, or failed → 500 so Stripe retries.
 */
export function createWebhookProcessor(deps: {
  sync: BillingSync | null;
  secret: string | undefined;
  logger: Logger;
  reporter: ErrorReporter;
  staleMs?: number;
}) {
  return async (payload: Buffer, signature: string | undefined): Promise<WebhookReply> => {
    if (!deps.sync || !deps.secret) {
      return { status: 503, body: { error: 'billing is not configured' } };
    }
    if (!signature || !Buffer.isBuffer(payload)) {
      return { status: 400, body: { error: 'missing signature' } };
    }
    let event: ReturnType<typeof verifyWebhookEvent>;
    try {
      event = verifyWebhookEvent(payload, signature, deps.secret);
    } catch {
      deps.logger.warn('stripe webhook with a bad signature');
      return { status: 400, body: { error: 'bad signature' } };
    }
    const log = deps.logger.child({ stripeEventId: event.id, stripeEventType: event.type });

    const handler = event.objectId ? route(deps.sync, event.type, event.objectId) : null;
    if (!handler) return { status: 200, body: { received: true, ignored: true } };

    const claim = await stripeEventsRepo.claim(event, deps.staleMs ?? STALE_CLAIM_MS);
    if (claim === 'done') return { status: 200, body: { received: true, duplicate: true } };
    if (claim === 'in_progress') return { status: 409, body: { error: 'already processing' } };

    try {
      const result = await handler();
      await stripeEventsRepo.markDone(event.id);
      log.info(result, 'stripe event handled');
      return { status: 200, body: { received: true } };
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      await stripeEventsRepo.markFailed(event.id, message);
      log.error({ err }, 'stripe event failed');
      deps.reporter.capture(err, { stripeEventId: event.id, stripeEventType: event.type });
      return { status: 500, body: { error: 'handler failed' } };
    }
  };
}

export type WebhookProcessor = ReturnType<typeof createWebhookProcessor>;
