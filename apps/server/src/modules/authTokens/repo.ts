import mongoose, { type Types } from 'mongoose';
import { AuthTokenModel, type AuthTokenDoc, type AuthTokenType } from './model';

export type { AuthTokenType };

export const authTokensRepo = {
  /** Stores a new token, invalidates the user's older unused ones of that type, returns its id. */
  async issue(
    userId: Types.ObjectId,
    type: AuthTokenType,
    tokenHash: string,
    ttlMs: number,
  ): Promise<Types.ObjectId> {
    const now = new Date();
    await AuthTokenModel.updateMany(
      { userId, type, usedAt: null },
      { $set: { usedAt: now, expiresAt: now } },
    );
    const doc = await AuthTokenModel.create({
      userId,
      type,
      tokenHash,
      expiresAt: new Date(now.getTime() + ttlMs),
    });
    return doc._id;
  },

  /** Marks a valid token used and returns it. Single use: a second call gets null. */
  consume(tokenHash: string, type: AuthTokenType): Promise<AuthTokenDoc | null> {
    return AuthTokenModel.findOneAndUpdate(
      { tokenHash, type, usedAt: null, expiresAt: mongoose.trusted({ $gt: new Date() }) },
      { $set: { usedAt: new Date() } },
      { new: true },
    )
      .lean<AuthTokenDoc>()
      .exec();
  },
};
