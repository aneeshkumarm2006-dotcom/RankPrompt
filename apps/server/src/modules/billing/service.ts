import { type PaidTier, type RedirectUrl, type Subscription, type TopupPack } from '@pv/shared';
import type { Logger } from '../../config/logger';
import type { Ctx } from '../../http/context';
import { AppError } from '../../http/errors';
import { usersRepo } from '../users/repo';
import { workspacesRepo, type WorkspaceDoc } from '../workspaces/repo';
import type { BillingGateway } from './gateway';
import type { PriceBook } from './prices';
import { lifecycleOf } from './sync';

export interface BillingServiceDeps {
  /** Null when `STRIPE_SECRET_KEY` is unset (development and test only). */
  gateway: BillingGateway | null;
  prices: PriceBook;
  appUrl: string;
  logger: Logger;
}

const notConfigured = () =>
  new AppError('UPSTREAM_UNAVAILABLE', 'Billing is not configured on this server');

export const toSubscription = (ws: WorkspaceDoc): Subscription => ({
  tier: ws.plan.tier,
  status: ws.plan.status,
  currentPeriodEnd: ws.plan.currentPeriodEnd?.toISOString() ?? null,
  cancelAtPeriodEnd: ws.plan.cancelAtPeriodEnd,
  pendingTier: ws.plan.pendingTier,
});

/** Checkout, top-up, portal and subscription info (06 § Endpoints, F-29, F-30). */
export function createBillingService(deps: BillingServiceDeps) {
  const billingUrl = (query: string) => `${deps.appUrl}/app/billing?${query}`;

  async function workspace(ctx: Ctx): Promise<WorkspaceDoc> {
    const ws = await workspacesRepo.findById(ctx.workspaceId);
    if (!ws) throw new AppError('UNAUTHENTICATED', 'Please sign in');
    return ws;
  }

  /** Buying needs the workspace owner with a verified email (07, 08 `owner`). */
  async function assertCanBuy(ctx: Ctx): Promise<{ gateway: BillingGateway; ws: WorkspaceDoc }> {
    if (!deps.gateway) throw notConfigured();
    if (ctx.role !== 'owner') {
      throw new AppError('FORBIDDEN', 'Only the workspace owner can manage billing');
    }
    const user = await usersRepo.findById(ctx.userId);
    if (!user?.emailVerifiedAt) {
      throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before buying');
    }
    return { gateway: deps.gateway, ws: await workspace(ctx) };
  }

  /**
   * The workspace's one Stripe customer, created at its first checkout (06 § Setup). The Stripe
   * call is idempotent per workspace and the stored id wins a race, so there is never a second.
   */
  async function customerFor(ctx: Ctx, gateway: BillingGateway, ws: WorkspaceDoc) {
    if (ws.stripe.customerId) return ws.stripe.customerId;
    const user = await usersRepo.findById(ctx.userId);
    const created = await gateway.createCustomer({
      workspaceId: ws._id.toHexString(),
      email: user?.email ?? '',
      name: user?.name ?? ws.name,
    });
    return workspacesRepo.setCustomerIdOnce(ws._id, created);
  }

  /** Stripe failures become a retryable 503; the details go to the log only. */
  async function callStripe<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AppError) throw err;
      deps.logger.error({ err }, `stripe ${what} failed`);
      throw new AppError('UPSTREAM_UNAVAILABLE', 'Billing is unavailable. Please try again.');
    }
  }

  return {
    async subscription(ctx: Ctx): Promise<Subscription> {
      return toSubscription(await workspace(ctx));
    },

    /** A subscription Checkout Session. Refused while the workspace already has a live plan. */
    async checkout(ctx: Ctx, tier: PaidTier): Promise<RedirectUrl> {
      const { gateway, ws } = await assertCanBuy(ctx);
      if (ws.stripe.subscriptionId && lifecycleOf(ws.plan.status) === 'live') {
        throw new AppError(
          'SUBSCRIPTION_EXISTS',
          'You already have a subscription. Use "Manage subscription" to change plans.',
        );
      }
      const priceId = deps.prices.forTier(tier);
      if (!priceId) throw notConfigured();
      return callStripe('checkout', async () => {
        const customerId = await customerFor(ctx, gateway, ws);
        const session = await gateway.createCheckoutSession({
          mode: 'subscription',
          customerId,
          priceId,
          successUrl: billingUrl('checkout=success&session_id={CHECKOUT_SESSION_ID}'),
          cancelUrl: billingUrl('checkout=cancel'),
          metadata: { workspaceId: ws._id.toHexString(), tier },
        });
        return { url: session.url };
      });
    },

    /** A one-time payment for a credit pack; the webhook grants the credits once it's paid. */
    async topup(ctx: Ctx, pack: TopupPack): Promise<RedirectUrl> {
      const { gateway, ws } = await assertCanBuy(ctx);
      const priceId = deps.prices.forPack(pack);
      if (!priceId) throw notConfigured();
      return callStripe('top-up checkout', async () => {
        const customerId = await customerFor(ctx, gateway, ws);
        const session = await gateway.createCheckoutSession({
          mode: 'payment',
          customerId,
          priceId,
          successUrl: billingUrl('topup=success&session_id={CHECKOUT_SESSION_ID}'),
          cancelUrl: billingUrl('topup=cancel'),
          metadata: { workspaceId: ws._id.toHexString(), pack },
        });
        return { url: session.url };
      });
    },

    /** The Stripe Customer Portal: switch plan, cancel at period end, update the card. */
    async portal(ctx: Ctx): Promise<RedirectUrl> {
      if (!deps.gateway) throw notConfigured();
      if (ctx.role !== 'owner') {
        throw new AppError('FORBIDDEN', 'Only the workspace owner can manage billing');
      }
      const ws = await workspace(ctx);
      const customerId = ws.stripe.customerId;
      if (!customerId) {
        throw new AppError('CONFLICT', 'There is no billing account yet. Choose a plan first.');
      }
      const gateway = deps.gateway;
      return callStripe('portal', () =>
        gateway.createPortalSession({ customerId, returnUrl: `${deps.appUrl}/app/billing` }),
      );
    },
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
