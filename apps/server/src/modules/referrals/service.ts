import { CREDIT_GRANTS } from '@pv/shared';
import type { ClientSession, Types } from 'mongoose';
import { applyCreditChange } from '../credits/service';
import { referralsRepo } from './repo';

/**
 * Settles the referred user's pending referral when their email becomes verified (06 § Referral
 * rules, F-04), inside the caller's transaction: +10 purchased credits to the referrer, ledger
 * `referral` under `user/<referredUserId>`. A referrer workspace the user belongs to (a
 * self-referral) is rejected instead. Returns what happened, or null when there was nothing.
 */
export async function settleReferral(
  session: ClientSession,
  referred: { userId: Types.ObjectId; workspaceIds: readonly Types.ObjectId[] },
): Promise<'credited' | 'rejected' | null> {
  const pending = await referralsRepo.findPending(session, referred.userId);
  if (!pending) return null;
  const self = referred.workspaceIds.some((id) => id.equals(pending.referrerWorkspaceId));
  const referral = await referralsRepo.settle(
    session,
    referred.userId,
    self ? 'rejected' : 'credited',
  );
  if (!referral || self) return referral ? 'rejected' : null;
  await applyCreditChange(session, {
    workspaceId: referral.referrerWorkspaceId,
    bucket: 'purchased',
    delta: CREDIT_GRANTS.referral,
    reason: 'referral',
    refType: 'user',
    refId: referred.userId.toHexString(),
    note: 'Referral reward: a referred user verified their email',
  });
  return 'credited';
}
