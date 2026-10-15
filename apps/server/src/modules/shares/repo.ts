import { Types, type ClientSession } from 'mongoose';
import { ShareModel, type ShareDoc } from './model';

export type { ShareDoc };

interface Scope {
  workspaceId: string | Types.ObjectId;
}

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);
const ws = (scope: Scope) => ({ workspaceId: oid(scope.workspaceId) });

/** Every owner query is filtered by workspace (07, layer 1). */
export const sharesRepo = {
  async create(
    scope: Scope,
    share: Pick<ShareDoc, 'runId' | 'tokenHash' | 'createdBy' | 'expiresAt'>,
  ): Promise<ShareDoc> {
    const doc = await ShareModel.create({ ...share, ...ws(scope) });
    return doc.toObject<ShareDoc>();
  },

  listForRun(scope: Scope, runId: string): Promise<ShareDoc[]> {
    return ShareModel.find({ ...ws(scope), runId: oid(runId) })
      .sort({ createdAt: -1 })
      .lean<ShareDoc[]>()
      .exec();
  },

  /** Revokes a live share. False when there's no such share in the workspace. */
  async revoke(scope: Scope, id: string): Promise<boolean> {
    const res = await ShareModel.updateOne(
      { ...ws(scope), _id: oid(id) },
      { $set: { revokedAt: new Date() } },
    );
    return res.matchedCount === 1;
  },

  /**
   * The public lookup: by token hash alone (the token is the credential), so it opts out of the
   * workspace scope. Revoked and expired shares are treated as missing by the caller.
   */
  findByTokenHash(tokenHash: string): Promise<ShareDoc | null> {
    return ShareModel.findOne({ tokenHash })
      .setOptions({ crossWorkspace: true })
      .lean<ShareDoc>()
      .exec();
  },

  async recordView(share: Pick<ShareDoc, '_id' | 'workspaceId'>): Promise<void> {
    await ShareModel.updateOne(
      { workspaceId: share.workspaceId, _id: share._id },
      { $set: { lastViewedAt: new Date() }, $inc: { viewCount: 1 } },
    );
  },

  async deleteForRun(session: ClientSession, scope: Scope, runId: Types.ObjectId): Promise<void> {
    await ShareModel.deleteMany({ ...ws(scope), runId }, { session });
  },
};
