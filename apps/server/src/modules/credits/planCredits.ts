import type { Types } from 'mongoose';
import { isDuplicateKeyError } from '../../db/errors';
import { withTransaction } from '../../db/transaction';
import { workspacesRepo } from '../workspaces/repo';
import { applyCreditChange } from './service';

/**
 * The plan-bucket rules and top-ups that Stripe drives (06 § Grants and spends), each in one
 * transaction through `applyCreditChange`. Every row is keyed by the Stripe object that caused
 * it, so a replay hits the ledger's unique key and changes nothing (`already_applied`).
 */

export type PlanGrantOutcome = 'reset' | 'raised' | 'unchanged' | 'already_applied';

/**
 * A paid subscription invoice (D-025):
 * - it opens a newer billing period than the last reset → plan credits are **reset** to the
 *   allowance (`plan_reset` −old balance, `plan_grant` +allowance);
 * - same period, higher allowance (an upgrade's proration invoice) → **raised** to the new
 *   allowance, never lowered;
 * - anything else (a replay, a late invoice, a downgrade) → unchanged.
 * Rows use `stripe_invoice/<in_id>`.
 */
export async function applyPaidInvoice(g: {
  workspaceId: Types.ObjectId;
  invoiceId: string;
  periodStart: Date;
  allowance: number;
  planName: string;
}): Promise<PlanGrantOutcome> {
  const ref = { refType: 'stripe_invoice', refId: g.invoiceId } as const;
  try {
    return await withTransaction(async (session) => {
      const ws = await workspacesRepo.planCredits(session, g.workspaceId);
      if (!ws) throw new Error(`workspace ${g.workspaceId.toHexString()} not found`);
      const last = ws.planCredits.periodStart;

      if (!last || g.periodStart.getTime() > last.getTime()) {
        if (ws.credits.plan > 0) {
          await applyCreditChange(session, {
            workspaceId: g.workspaceId,
            bucket: 'plan',
            delta: -ws.credits.plan,
            reason: 'plan_reset',
            ...ref,
            note: 'Plan credits reset for the new billing period',
          });
        }
        if (g.allowance > 0) {
          await applyCreditChange(session, {
            workspaceId: g.workspaceId,
            bucket: 'plan',
            delta: g.allowance,
            reason: 'plan_grant',
            ...ref,
            note: `${g.planName} plan credits`,
          });
        }
        await workspacesRepo.setPlanCredits(session, g.workspaceId, {
          periodStart: g.periodStart,
          allowance: g.allowance,
        });
        return 'reset';
      }

      if (g.allowance > ws.planCredits.allowance) {
        const topUp = g.allowance - ws.credits.plan;
        if (topUp > 0) {
          await applyCreditChange(session, {
            workspaceId: g.workspaceId,
            bucket: 'plan',
            delta: topUp,
            reason: 'plan_grant',
            ...ref,
            note: `Upgraded to ${g.planName}: plan credits topped up`,
          });
        }
        await workspacesRepo.setPlanCredits(session, g.workspaceId, {
          periodStart: last,
          allowance: g.allowance,
        });
        return 'raised';
      }
      return 'unchanged';
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return 'already_applied';
    throw err;
  }
}

/**
 * The subscription ended: plan credits go to 0 (`plan_reset` under `stripe_sub_end/<sub_id>`).
 * Purchased credits are kept.
 */
export async function endPlanCredits(e: {
  workspaceId: Types.ObjectId;
  subscriptionId: string;
}): Promise<'reset' | 'unchanged' | 'already_applied'> {
  try {
    return await withTransaction(async (session) => {
      const ws = await workspacesRepo.planCredits(session, e.workspaceId);
      if (!ws) throw new Error(`workspace ${e.workspaceId.toHexString()} not found`);
      await workspacesRepo.setPlanCredits(session, e.workspaceId, {
        periodStart: null,
        allowance: 0,
      });
      if (ws.credits.plan <= 0) return 'unchanged';
      await applyCreditChange(session, {
        workspaceId: e.workspaceId,
        bucket: 'plan',
        delta: -ws.credits.plan,
        reason: 'plan_reset',
        refType: 'stripe_sub_end',
        refId: e.subscriptionId,
        note: 'Subscription ended: plan credits removed (purchased credits are kept)',
      });
      return 'reset';
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return 'already_applied';
    throw err;
  }
}

/** A paid top-up: purchased credits, `topup` under `stripe_session/<cs_id>`. */
export async function grantTopup(t: {
  workspaceId: Types.ObjectId;
  sessionId: string;
  credits: number;
}): Promise<'granted' | 'already_applied'> {
  try {
    await withTransaction((session) =>
      applyCreditChange(session, {
        workspaceId: t.workspaceId,
        bucket: 'purchased',
        delta: t.credits,
        reason: 'topup',
        refType: 'stripe_session',
        refId: t.sessionId,
        note: `Top-up: ${t.credits} credits`,
      }),
    );
    return 'granted';
  } catch (err) {
    if (isDuplicateKeyError(err)) return 'already_applied';
    throw err;
  }
}
