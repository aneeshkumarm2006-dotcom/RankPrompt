import mongoose, { Types, type ClientSession } from 'mongoose';
import { SessionModel, type SessionDoc } from './model';

export type { SessionDoc };

const trusted = mongoose.trusted;
const live = () => ({ revokedAt: null, expiresAt: trusted({ $gt: new Date() }) });

export const sessionsRepo = {
  async create(
    doc: Pick<
      SessionDoc,
      '_id' | 'userId' | 'workspaceId' | 'familyId' | 'tokenHash' | 'userAgent' | 'ip' | 'expiresAt'
    >,
    session?: ClientSession,
  ): Promise<void> {
    await SessionModel.create([doc], session ? { session } : {});
  },

  findByTokenHash(tokenHash: string): Promise<SessionDoc | null> {
    return SessionModel.findOne({ tokenHash }).lean<SessionDoc>().exec();
  },

  /** True while the session is neither revoked nor expired. */
  async isLive(id: string): Promise<boolean> {
    return (await SessionModel.exists({ _id: new Types.ObjectId(id), ...live() })) !== null;
  },

  /**
   * Atomically retires a live session in favour of `replacedBy`. Only one caller can win, so two
   * instances can never both rotate the same refresh token.
   */
  async claimForRotation(
    id: Types.ObjectId,
    replacedBy: Types.ObjectId,
    session: ClientSession,
  ): Promise<boolean> {
    const res = await SessionModel.updateOne(
      { _id: id, replacedBy: null, ...live() },
      { $set: { revokedAt: new Date(), replacedBy } },
      { session },
    );
    return res.modifiedCount === 1;
  },

  async revoke(id: Types.ObjectId): Promise<void> {
    await SessionModel.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },

  /** Reuse detected: every session of the rotation family goes. */
  async revokeFamily(familyId: string): Promise<void> {
    await SessionModel.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  },

  /** Password change or reset: all of the user's sessions, optionally keeping the current one. */
  async revokeAllForUser(userId: Types.ObjectId, exceptId?: Types.ObjectId): Promise<void> {
    await SessionModel.updateMany(
      { userId, revokedAt: null, ...(exceptId ? { _id: trusted({ $ne: exceptId }) } : {}) },
      { $set: { revokedAt: new Date() } },
    );
  },
};
