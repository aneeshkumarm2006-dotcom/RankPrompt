import mongoose, { Types, type ClientSession } from 'mongoose';
import { UserModel, type UserDoc } from './model';

export type { UserDoc };

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);

/** Users are global (not workspace-owned), so lookups are by id, email or Google id. */
export const usersRepo = {
  async create(
    session: ClientSession,
    user: Pick<
      UserDoc,
      | '_id'
      | 'email'
      | 'name'
      | 'passwordHash'
      | 'emailVerifiedAt'
      | 'avatarUrl'
      | 'defaultWorkspaceId'
    > & { googleId?: string },
  ): Promise<void> {
    await UserModel.create([user], { session });
  },

  findById(id: string | Types.ObjectId): Promise<UserDoc | null> {
    return UserModel.findById(oid(id)).lean<UserDoc>().exec();
  },

  findByEmail(email: string): Promise<UserDoc | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).lean<UserDoc>().exec();
  },

  findByGoogleId(googleId: string): Promise<UserDoc | null> {
    return UserModel.findOne({ googleId }).lean<UserDoc>().exec();
  },

  async touchLogin(id: Types.ObjectId): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  },

  /**
   * Links a Google account to an existing user. Only when the user has no Google id yet, so a
   * second Google account can't take it over. Null when it was already linked.
   */
  async linkGoogle(
    id: Types.ObjectId,
    googleId: string,
    avatarUrl: string | null,
    opts: { dropPassword?: boolean } = {},
  ): Promise<UserDoc | null> {
    const user = await UserModel.findOneAndUpdate(
      // sanitizeFilter is on (07): real operators must be marked trusted.
      { _id: id, googleId: mongoose.trusted({ $exists: false }) },
      { $set: { googleId, ...(opts.dropPassword ? { passwordHash: null } : {}) } },
      { new: true },
    )
      .lean<UserDoc>()
      .exec();
    if (!user || !avatarUrl || user.avatarUrl) return user;
    return UserModel.findOneAndUpdate({ _id: id }, { $set: { avatarUrl } }, { new: true })
      .lean<UserDoc>()
      .exec();
  },

  /** Sets `emailVerifiedAt` once. True when this call is the one that verified it. */
  async markEmailVerified(id: Types.ObjectId, session?: ClientSession): Promise<boolean> {
    const res = await UserModel.updateOne(
      { _id: id, emailVerifiedAt: null },
      { $set: { emailVerifiedAt: new Date() } },
      session ? { session } : {},
    ).exec();
    return res.modifiedCount === 1;
  },

  async setPasswordHash(id: Types.ObjectId, passwordHash: string): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { passwordHash } }).exec();
  },

  updateProfile(
    id: string | Types.ObjectId,
    patch: {
      name?: string;
      avatarUrl?: string | null;
      emailPrefs?: { runCompleted?: boolean | undefined; lowCredits?: boolean | undefined };
    },
  ): Promise<UserDoc | null> {
    const { emailPrefs, ...rest } = patch;
    const set: Record<string, unknown> = { ...rest };
    for (const [k, v] of Object.entries(emailPrefs ?? {})) {
      if (v !== undefined) set[`emailPrefs.${k}`] = v;
    }
    return UserModel.findOneAndUpdate({ _id: oid(id) }, { $set: set }, { new: true })
      .lean<UserDoc>()
      .exec();
  },
};
