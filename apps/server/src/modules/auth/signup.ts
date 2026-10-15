import { randomInt } from 'node:crypto';
import { CREDIT_GRANTS, referralCodeSchema } from '@pv/shared';
import { Types } from 'mongoose';
import { isDuplicateKeyError } from '../../db/errors';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../http/errors';
import { applyCreditChange } from '../credits/service';
import { membershipsRepo } from '../memberships/repo';
import { referralsRepo } from '../referrals/repo';
import { settleReferral } from '../referrals/service';
import { usersRepo } from '../users/repo';
import { workspacesRepo } from '../workspaces/repo';

/** No 0/O or 1/I, so a code read aloud or retyped still works. */
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const newReferralCode = (): string =>
  Array.from({ length: 8 }, () => REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)]).join('');

export interface NewAccount {
  email: string;
  name: string;
  passwordHash: string | null;
  googleId?: string;
  avatarUrl?: string | null;
  /** Set for Google sign-up (Google verified the email). */
  emailVerified: boolean;
  /** The `?ref=` code, if any. Unknown or malformed codes are ignored. */
  ref?: string | undefined;
}

/**
 * Creates a complete account in ONE transaction (07, F-04, F-05): user, personal workspace, owner
 * membership, the 50-credit signup bonus (ledger row + balance) and a pending referral (settled at
 * once when the email is already verified). Either all
 * of it exists afterwards or none of it does.
 */
export async function createAccount(
  account: NewAccount,
): Promise<{ userId: Types.ObjectId; workspaceId: Types.ObjectId }> {
  const referrer = await findReferrer(account.ref);

  for (let attempt = 1; ; attempt++) {
    try {
      return await withTransaction(async (session) => {
        const userId = new Types.ObjectId();
        const workspaceId = new Types.ObjectId();

        await workspacesRepo.create(session, {
          _id: workspaceId,
          name: `${account.name}'s workspace`,
          referralCode: newReferralCode(),
        });
        await usersRepo.create(session, {
          _id: userId,
          email: account.email,
          name: account.name,
          passwordHash: account.passwordHash,
          emailVerifiedAt: account.emailVerified ? new Date() : null,
          avatarUrl: account.avatarUrl ?? null,
          defaultWorkspaceId: workspaceId,
          ...(account.googleId ? { googleId: account.googleId } : {}),
        });
        await membershipsRepo.create(session, { workspaceId, userId, role: 'owner' });
        await applyCreditChange(session, {
          workspaceId,
          bucket: 'purchased',
          delta: CREDIT_GRANTS.signupBonus,
          reason: 'signup_bonus',
          refType: 'user',
          refId: userId.toHexString(),
          note: 'Signup bonus',
          actorUserId: userId,
        });
        if (referrer) {
          await referralsRepo.createPending(session, {
            referrerWorkspaceId: referrer,
            referredUserId: userId,
          });
          // Google sign-up arrives verified, so the referral is settled at once (6.4).
          if (account.emailVerified) {
            await settleReferral(session, { userId, workspaceIds: [workspaceId] });
          }
        }
        return { userId, workspaceId };
      });
    } catch (err) {
      if (isDuplicateKeyError(err, 'email') || isDuplicateKeyError(err, 'googleId')) {
        throw new AppError('CONFLICT', 'An account with this email already exists');
      }
      // A referral-code collision (32^8 space) is retried with a fresh code.
      if (isDuplicateKeyError(err, 'referralCode') && attempt < 3) continue;
      throw err;
    }
  }
}

async function findReferrer(ref: string | undefined): Promise<Types.ObjectId | null> {
  if (!ref) return null;
  const code = referralCodeSchema.safeParse(ref);
  if (!code.success) return null;
  const ws = await workspacesRepo.findByReferralCode(code.data);
  return ws?._id ?? null;
}
