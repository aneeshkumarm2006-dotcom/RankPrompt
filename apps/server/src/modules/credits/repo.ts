import { Types, type ClientSession } from 'mongoose';
import { op } from '../../db/trusted';
import { LedgerModel, type LedgerDoc } from './model';

export type { LedgerDoc };
export type { LedgerReason } from './model';

export const ledgerRepo = {
  async insert(
    session: ClientSession,
    row: Omit<LedgerDoc, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    await LedgerModel.create([row], { session });
  },

  /** Sum of the ledger deltas per bucket: must always equal `workspaces.credits` (06). */
  async sums(workspaceId: Types.ObjectId): Promise<{ plan: number; purchased: number }> {
    const rows = await LedgerModel.aggregate<{ _id: 'plan' | 'purchased'; total: number }>([
      { $match: { workspaceId } },
      { $group: { _id: '$bucket', total: { $sum: '$delta' } } },
    ]);
    const out = { plan: 0, purchased: 0 };
    for (const r of rows) out[r._id] = r.total;
    return out;
  },

  /**
   * Ledger sums per workspace and bucket for a batch of workspaces, read inside the caller's
   * (snapshot) transaction so they line up with the balances read in it (06 § reconciliation).
   */
  async sumsFor(
    session: ClientSession,
    workspaceIds: Types.ObjectId[],
  ): Promise<Map<string, { plan: number; purchased: number }>> {
    const rows = await LedgerModel.aggregate<{
      _id: { ws: Types.ObjectId; bucket: 'plan' | 'purchased' };
      total: number;
    }>([
      { $match: { workspaceId: op({ $in: workspaceIds }) } },
      { $group: { _id: { ws: '$workspaceId', bucket: '$bucket' }, total: { $sum: '$delta' } } },
    ]).session(session);
    const out = new Map<string, { plan: number; purchased: number }>();
    for (const r of rows) {
      const key = r._id.ws.toHexString();
      const sums = out.get(key) ?? { plan: 0, purchased: 0 };
      sums[r._id.bucket] = r.total;
      out.set(key, sums);
    }
    return out;
  },

  /** Rows that reference one thing (a run's reserves and refunds), oldest first. */
  listForRef(workspaceId: Types.ObjectId, refType: string, refIds: string[]): Promise<LedgerDoc[]> {
    return LedgerModel.find({ workspaceId, refType, refId: op({ $in: refIds }) })
      .sort({ createdAt: 1, _id: 1 })
      .lean<LedgerDoc[]>()
      .exec();
  },

  /** Newest first, `_id` cursor: the credits page (08 `GET /credits/ledger`). */
  page(workspaceId: string, cursor: string | undefined, limit: number): Promise<LedgerDoc[]> {
    return LedgerModel.find({
      workspaceId: new Types.ObjectId(workspaceId),
      ...(cursor ? { _id: op({ $lt: new Types.ObjectId(cursor) }) } : {}),
    })
      .sort({ _id: -1 })
      .limit(limit)
      .lean<LedgerDoc[]>()
      .exec();
  },

  /** Total credits a workspace earned from referrals. */
  async referralCredits(workspaceId: string): Promise<number> {
    const rows = await LedgerModel.aggregate<{ total: number }>([
      { $match: { workspaceId: new Types.ObjectId(workspaceId), reason: 'referral' } },
      { $group: { _id: null, total: { $sum: '$delta' } } },
    ]);
    return rows[0]?.total ?? 0;
  },

  /** Newest first, for one workspace. */
  listForWorkspace(workspaceId: string, limit: number): Promise<LedgerDoc[]> {
    return LedgerModel.find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<LedgerDoc[]>()
      .exec();
  },
};
