import { PLANS, TOPUPS, type PaidTier, type PlanStatus } from '@pv/shared';
import type { Logger } from '../../config/logger';
import type { ErrorReporter } from '../../config/sentry';
import type { EmailOutbox } from '../../emails/outbox';
import { applyPaidInvoice, endPlanCredits, grantTopup } from '../credits/planCredits';
import { workspacesRepo, type WorkspaceDoc } from '../workspaces/repo';
import type { BillingGateway, SubscriptionSnapshot } from './gateway';
import type { PriceBook } from './prices';

/**
 * Stripe status → ours (06 notes). v1 stored Stripe's raw values, and the ones outside its enum
 * later broke `save()`; every value is mapped here explicitly.
 */
export function mapStripeStatus(status: string): PlanStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default: // 'incomplete' (first payment not made yet) and anything new
      return 'none';
  }
}

/** live: the plan applies; ended: it's over; pending: not started yet (incomplete). */
export function lifecycleOf(status: string): 'live' | 'ended' | 'pending' {
  const mapped = mapStripeStatus(status);
  if (mapped === 'active' || mapped === 'past_due') return 'live';
  return mapped === 'canceled' ? 'ended' : 'pending';
}

export interface SyncDeps {
  gateway: BillingGateway;
  prices: PriceBook;
  logger: Logger;
  reporter: ErrorReporter;
  emails: EmailOutbox;
  appUrl: string;
}

/** What a handler did, for the log line. */
export type SyncResult = { outcome: string; workspaceId?: string };

const FREE_PLAN: WorkspaceDoc['plan'] = {
  tier: 'free',
  status: 'canceled',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  pendingTier: null,
};

/**
 * Webhook handlers (06 § Webhook processing). Each one re-fetches what it needs from Stripe and
 * writes the result, so it doesn't matter in which order, or how often, events arrive.
 */
export function createBillingSync(deps: SyncDeps) {
  const { gateway, prices, logger } = deps;

  async function workspaceFor(customerId: string | null): Promise<WorkspaceDoc | null> {
    if (!customerId) return null;
    const ws = await workspacesRepo.findByCustomerId(customerId);
    // Customers made by v1 or by hand share the account; their events aren't ours to handle.
    if (!ws) logger.info({ customerId }, 'stripe event for an unknown customer: ignored');
    return ws;
  }

  /**
   * Writes the plan state of a live subscription, or ends the plan when the subscription the
   * workspace is on has ended. Never grants credits (invoice.paid does). `tier` is set only when
   * the subscription is live. `paymentFailed` marks an active one past_due (an open invoice).
   */
  async function syncSubscription(
    sub: SubscriptionSnapshot,
    opts: { paymentFailed?: boolean } = {},
  ): Promise<{ ws: WorkspaceDoc | null; tier: PaidTier | null; result: SyncResult }> {
    const ws = await workspaceFor(sub.customerId);
    if (!ws) return { ws, tier: null, result: { outcome: 'unknown_customer' } };
    const workspaceId = ws._id.toHexString();
    const current = ws.stripe.subscriptionId;
    const lifecycle = lifecycleOf(sub.status);

    if (lifecycle === 'ended') {
      // An older subscription ending while the workspace is on a newer one changes nothing.
      if (current && current !== sub.id) {
        return { ws, tier: null, result: { outcome: 'old_subscription', workspaceId } };
      }
      await workspacesRepo.setPlanState(ws._id, {
        plan: FREE_PLAN,
        subscriptionId: null,
        priceId: null,
      });
      const credits = await endPlanCredits({ workspaceId: ws._id, subscriptionId: sub.id });
      return { ws, tier: null, result: { outcome: `ended:${credits}`, workspaceId } };
    }
    if (lifecycle === 'pending') {
      return { ws, tier: null, result: { outcome: `pending:${sub.status}`, workspaceId } };
    }

    const tier = sub.priceId ? prices.tierOf(sub.priceId) : null;
    if (!tier) {
      // A config problem (a price id missing from env): fail the event so Stripe retries it
      // after the env is fixed, instead of guessing a tier.
      throw new Error(
        `subscription ${sub.id} has price ${sub.priceId ?? 'none'}, not a plan price`,
      );
    }
    const pendingTier = sub.pendingPriceId ? prices.tierOf(sub.pendingPriceId) : null;
    if (sub.pendingPriceId && !pendingTier) {
      logger.warn(
        { subscriptionId: sub.id, priceId: sub.pendingPriceId },
        'unknown scheduled price',
      );
    }
    if (current && current !== sub.id && lifecycleOf(ws.plan.status) === 'live') {
      const err = new Error('workspace has a second live Stripe subscription');
      logger.error({ workspaceId, current, incoming: sub.id }, err.message);
      deps.reporter.capture(err, { workspaceId, current, incoming: sub.id });
    }
    const mapped = mapStripeStatus(sub.status);
    await workspacesRepo.setPlanState(ws._id, {
      plan: {
        tier,
        status: opts.paymentFailed && mapped === 'active' ? 'past_due' : mapped,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        pendingTier: pendingTier === tier ? null : pendingTier,
      },
      subscriptionId: sub.id,
      priceId: sub.priceId,
    });
    return { ws, tier, result: { outcome: `synced:${tier}:${sub.status}`, workspaceId } };
  }

  /** `payfail:<invoiceId>` to each owner; queued, so a redelivered event can't email twice. */
  async function notifyPaymentFailed(ws: WorkspaceDoc, invoiceId: string): Promise<void> {
    const billingLink = `${deps.appUrl}/app/billing`;
    await deps.emails.toOwners(ws._id, 'payment_failed', `payfail:${invoiceId}`, (user) => ({
      name: user.name,
      billingLink,
    }));
  }

  async function subscriptionChanged(subscriptionId: string): Promise<SyncResult> {
    return (await syncSubscription(await gateway.getSubscription(subscriptionId))).result;
  }

  return {
    subscriptionChanged,

    /** `invoice.paid` (and v1's `invoice.payment_succeeded`, the same moment): plan credits. */
    async invoicePaid(invoiceId: string): Promise<SyncResult> {
      const invoice = await gateway.getInvoice(invoiceId);
      if (!invoice.subscriptionId) return { outcome: 'not_a_subscription_invoice' };
      const sub = await gateway.getSubscription(invoice.subscriptionId);
      const { ws, tier, result } = await syncSubscription(sub);
      if (!ws || !tier || !sub.currentPeriodStart) return result;
      const plan = PLANS[tier];
      const credits = await applyPaidInvoice({
        workspaceId: ws._id,
        invoiceId: invoice.id,
        periodStart: sub.currentPeriodStart,
        allowance: plan.monthlyCredits,
        planName: plan.name,
      });
      return {
        outcome: `${result.outcome};credits:${credits};reason:${invoice.billingReason ?? '-'}`,
        workspaceId: ws._id.toHexString(),
      };
    },

    /** Status to past_due (unless it was paid since) and an email to the owners. */
    async invoicePaymentFailed(invoiceId: string): Promise<SyncResult> {
      const invoice = await gateway.getInvoice(invoiceId);
      if (!invoice.subscriptionId) return { outcome: 'not_a_subscription_invoice' };
      const sub = await gateway.getSubscription(invoice.subscriptionId);
      // Paid since (a retry succeeded before this event was handled): just sync, no email.
      const open = invoice.status === 'open';
      const { ws, tier, result } = await syncSubscription(sub, { paymentFailed: open });
      if (!ws || !tier || !open) return result;
      await notifyPaymentFailed(ws, invoice.id);
      return { outcome: `${result.outcome};payment_failed`, workspaceId: ws._id.toHexString() };
    },

    /** Checkout finished: a paid top-up grants credits; a subscription is synced (no credits). */
    async checkoutCompleted(sessionId: string): Promise<SyncResult> {
      const session = await gateway.getCheckoutSession(sessionId);
      if (session.mode === 'subscription') {
        if (!session.subscriptionId) return { outcome: 'no_subscription_yet' };
        return subscriptionChanged(session.subscriptionId);
      }
      if (session.mode !== 'payment') return { outcome: `ignored_mode:${session.mode}` };
      // Async payment methods complete later (`checkout.session.async_payment_succeeded`).
      if (session.paymentStatus !== 'paid') return { outcome: `unpaid:${session.paymentStatus}` };
      const ws = await workspaceFor(session.customerId);
      if (!ws) return { outcome: 'unknown_customer' };
      const pack = session.priceIds.map((id) => prices.packOf(id)).find((p) => p !== null);
      if (!pack) {
        throw new Error(
          `checkout ${session.id} paid for ${session.priceIds.join(',')}, not a top-up`,
        );
      }
      const outcome = await grantTopup({
        workspaceId: ws._id,
        sessionId: session.id,
        credits: TOPUPS[pack].credits,
      });
      return { outcome: `topup:${pack}:${outcome}`, workspaceId: ws._id.toHexString() };
    },
  };
}

export type BillingSync = ReturnType<typeof createBillingSync>;
