import { getPlan } from '@pv/shared';
import type { Types } from 'mongoose';
import type { EmailOutbox } from '../../emails/outbox';
import { workspacesRepo } from '../workspaces/repo';

/** Below this many credits the warning goes out even on a plan with no monthly allowance. */
export const LOW_CREDIT_FLOOR = 10;

/** 10 § Email `low_credits`: under 10 % of the plan allowance, or under 10 credits. */
export const lowCreditThreshold = (allowance: number): number =>
  Math.max(LOW_CREDIT_FLOOR, Math.ceil(allowance * 0.1));

/** The period a warning belongs to: the last plan-credit reset, or the UTC month without one. */
export function lowCreditPeriod(periodStart: Date | null, now = new Date()): string {
  const start = periodStart ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return start.toISOString().slice(0, 10);
}

/**
 * Called after a run reserves credits: when the balance has dropped under the threshold, the
 * owners get `low_credits`, at most once per period (`low:<workspaceId>:<periodStart>`). Users
 * can opt out of it in settings; the send job checks that.
 */
export function createLowCreditWarning(deps: { emails: EmailOutbox; appUrl: string }) {
  return async (workspaceId: Types.ObjectId): Promise<void> => {
    const ws = await workspacesRepo.findById(workspaceId);
    if (!ws) return;
    const allowance = ws.planCredits.allowance || getPlan(ws.plan.tier).monthlyCredits;
    const balance = ws.credits.plan + ws.credits.purchased;
    if (balance >= lowCreditThreshold(allowance)) return;
    const period = lowCreditPeriod(ws.planCredits.periodStart);
    await deps.emails.toOwners(
      ws._id,
      'low_credits',
      `low:${ws._id.toHexString()}:${period}`,
      (user) => ({
        name: user.name,
        balance,
        allowance,
        billingLink: `${deps.appUrl}/app/billing`,
        settingsLink: `${deps.appUrl}/app/settings`,
      }),
    );
  };
}
