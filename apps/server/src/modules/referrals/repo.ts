import { Types, type ClientSession } from 'mongoose';
import { ReferralModel, type ReferralDoc, type ReferralStatus } from './model';

export type { ReferralDoc };

export const referralsRepo = {
  async createPending(
    session: ClientSession,
    r: { referrerWorkspaceId: Types.ObjectId; referredUserId: Types.ObjectId },
  ): Promise<void> {
    await ReferralModel.create([{ ...r, status: 'pending' }], { session });
  },

  findPending(session: ClientSession, referredUserId: Types.ObjectId): Promise<ReferralDoc | null> {
    return ReferralModel.findOne({ referredUserId, status: 'pending' }, null, { session })
      .lean<ReferralDoc>()
      .exec();
  },

  /**
   * Moves the referred user's referral out of `pending`, atomically: only one caller can settle
   * it. Returns the referral as it was, or null when there is no pending one.
   */
  settle(
    session: ClientSession,
    referredUserId: Types.ObjectId,
    status: Exclude<ReferralStatus, 'pending'>,
  ): Promise<ReferralDoc | null> {
    return ReferralModel.findOneAndUpdate(
      { referredUserId, status: 'pending' },
      { $set: { status, creditedAt: status === 'credited' ? new Date() : null } },
      { session },
    )
      .lean<ReferralDoc>()
      .exec();
  },

  /** Referred users per status, for the referrer's credits page. Counts only, never emails (06). */
  async countsForReferrer(workspaceId: string): Promise<{ referred: number; credited: number }> {
    const rows = await ReferralModel.aggregate<{ _id: string; n: number }>([
      { $match: { referrerWorkspaceId: new Types.ObjectId(workspaceId) } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const referred = rows.reduce((sum, r) => sum + r.n, 0);
    const credited = rows.find((r) => r._id === 'credited')?.n ?? 0;
    return { referred, credited };
  },

  findByReferredUser(userId: Types.ObjectId): Promise<ReferralDoc | null> {
    return ReferralModel.findOne({ referredUserId: userId }).lean<ReferralDoc>().exec();
  },
};
