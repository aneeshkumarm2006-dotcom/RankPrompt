import { PLANS, type PlansResponse, type WorkspacePlan } from '@pv/shared';
import { errorMessage, hasCode, isNotFound } from '../../lib/errors';
import { formatDate, number, pluralize } from '../../lib/format';

export type PlanInfo = PlansResponse['plans'][number];

/** What a Stripe redirect back to `/app/billing?…` means, or null. */
export function returnNotice(
  params: URLSearchParams,
): { kind: 'success' | 'info'; message: string } | null {
  const checkout = params.get('checkout');
  const topup = params.get('topup');
  if (checkout === 'success') {
    return { kind: 'success', message: 'Subscription started. Your plan credits are on the way.' };
  }
  if (topup === 'success') {
    return { kind: 'success', message: 'Payment received. Your credits have been added.' };
  }
  if (checkout === 'cancel' || topup === 'cancel') {
    return { kind: 'info', message: 'Checkout canceled. You have not been charged.' };
  }
  return null;
}

/** The params that only exist to carry a Stripe return. */
export const RETURN_PARAMS = ['checkout', 'topup', 'session_id'] as const;

/** Feature lines for a plan card, all from `/plans` (no hardcoded numbers). */
export function planFeatures(plan: PlanInfo): string[] {
  const freqs = plan.limits.scheduleFrequencies;
  return [
    `${number(plan.monthlyCredits)} credits every month`,
    pluralize(plan.limits.brands, 'brand'),
    `Up to ${number(plan.limits.maxPromptsPerRun)} prompts per run`,
    pluralize(plan.limits.platforms.length, 'AI platform'),
    freqs.length > 0 ? `Scheduled reports: ${freqs.join(', ')}` : 'No scheduled reports',
  ];
}

export const tierName = (tier: WorkspacePlan['tier']): string => PLANS[tier].name;

/** "Renews on …", "Ends on …", "Switches to Pro on …". */
export function renewalText(sub: WorkspacePlan): string | null {
  if (sub.tier === 'free' || !sub.currentPeriodEnd) return null;
  const date = formatDate(sub.currentPeriodEnd);
  if (sub.cancelAtPeriodEnd) return `Ends on ${date}`;
  if (sub.pendingTier && sub.pendingTier !== sub.tier) {
    return `Switches to ${tierName(sub.pendingTier)} on ${date}`;
  }
  return `Renews on ${date}`;
}

export const STATUS_LABELS: Record<WorkspacePlan['status'], string> = {
  active: 'Active',
  past_due: 'Payment overdue',
  canceled: 'Canceled',
  none: 'No subscription',
};

/** A paid plan the user can manage in the Stripe portal. */
export const hasSubscription = (sub: WorkspacePlan): boolean =>
  sub.tier !== 'free' && (sub.status === 'active' || sub.status === 'past_due');

/** Friendly text for checkout / top-up / portal failures. */
export function billingErrorMessage(err: unknown): string {
  if (isNotFound(err)) return 'Checkout opens once billing is connected. Please check back soon.';
  if (hasCode(err, 'SUBSCRIPTION_EXISTS')) {
    return 'You already have a subscription. Use “Manage subscription” to change plans.';
  }
  if (hasCode(err, 'EMAIL_NOT_VERIFIED')) {
    return 'Please verify your email address first. Check your inbox for the link.';
  }
  if (hasCode(err, 'UPSTREAM_UNAVAILABLE')) {
    return 'Billing is unavailable right now. Please try again in a few minutes.';
  }
  return errorMessage(err);
}
