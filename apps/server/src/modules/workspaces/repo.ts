import type { CreditBucket } from '@pv/shared';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { WorkspaceModel, type WorkspaceDoc } from './model';

export type { WorkspaceDoc };

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);

export const workspacesRepo = {
  async create(
    session: ClientSession,
    ws: Pick<WorkspaceDoc, '_id' | 'name' | 'referralCode'>,
  ): Promise<void> {
    await WorkspaceModel.create([ws], { session });
  },

  findById(id: string | Types.ObjectId): Promise<WorkspaceDoc | null> {
    return WorkspaceModel.findById(oid(id)).lean<WorkspaceDoc>().exec();
  },

  /** The credit balance, read inside a transaction. */
  async credits(
    session: ClientSession,
    id: string | Types.ObjectId,
  ): Promise<WorkspaceDoc['credits'] | null> {
    const ws = await WorkspaceModel.findById(oid(id), { credits: 1 }, { session })
      .lean<Pick<WorkspaceDoc, 'credits'>>()
      .exec();
    return ws ? ws.credits : null;
  },

  findByReferralCode(code: string): Promise<WorkspaceDoc | null> {
    return WorkspaceModel.findOne({ referralCode: code }).lean<WorkspaceDoc>().exec();
  },

  /**
   * Writes the workspace inside `session`, so two transactions that both call this for the same
   * workspace conflict and one retries after the other commits. Used to make "count, then insert"
   * checks (like the brand limit) safe under concurrency.
   */
  async lock(session: ClientSession, id: string | Types.ObjectId): Promise<void> {
    await WorkspaceModel.updateOne({ _id: oid(id) }, { $inc: { lockVersion: 1 } }, { session });
  },

  // ---- Billing (06 § Stripe integration). Callers: the billing module only. --------------

  findByCustomerId(customerId: string): Promise<WorkspaceDoc | null> {
    return WorkspaceModel.findOne({ 'stripe.customerId': customerId }).lean<WorkspaceDoc>().exec();
  },

  /**
   * Stores the workspace's Stripe customer unless it already has one, and returns the customer
   * id it ends up with: the stored one wins, so a workspace never gets two customers.
   */
  async setCustomerIdOnce(id: string | Types.ObjectId, customerId: string): Promise<string> {
    const ws = await WorkspaceModel.findOneAndUpdate(
      { _id: oid(id), 'stripe.customerId': mongoose.trusted({ $exists: false }) },
      { $set: { 'stripe.customerId': customerId } },
      { new: true, projection: { stripe: 1 } },
    )
      .lean<Pick<WorkspaceDoc, 'stripe'>>()
      .exec();
    if (ws?.stripe.customerId) return ws.stripe.customerId;
    const existing = await WorkspaceModel.findById(oid(id), { stripe: 1 })
      .lean<Pick<WorkspaceDoc, 'stripe'>>()
      .exec();
    if (!existing?.stripe.customerId) throw new Error(`workspace ${String(id)} not found`);
    return existing.stripe.customerId;
  },

  /** Writes the plan state synced from Stripe. Never touches credits. */
  async setPlanState(
    id: Types.ObjectId,
    state: {
      plan: WorkspaceDoc['plan'];
      subscriptionId: string | null;
      priceId: string | null;
    },
  ): Promise<void> {
    await WorkspaceModel.updateOne(
      { _id: id },
      {
        $set: {
          plan: state.plan,
          'stripe.subscriptionId': state.subscriptionId,
          'stripe.priceId': state.priceId,
        },
      },
    ).exec();
  },

  /** The plan-credit bookkeeping and balance, read inside a transaction. */
  async planCredits(
    session: ClientSession,
    id: Types.ObjectId,
  ): Promise<Pick<WorkspaceDoc, 'credits' | 'planCredits'> | null> {
    return WorkspaceModel.findById(id, { credits: 1, planCredits: 1 }, { session })
      .lean<Pick<WorkspaceDoc, 'credits' | 'planCredits'>>()
      .exec();
  },

  async setPlanCredits(
    session: ClientSession,
    id: Types.ObjectId,
    planCredits: WorkspaceDoc['planCredits'],
  ): Promise<void> {
    await WorkspaceModel.updateOne({ _id: id }, { $set: { planCredits } }, { session }).exec();
  },

  /**
   * The next batch of workspaces in `_id` order with their balances, read inside the caller's
   * (snapshot) transaction: the nightly reconciliation.
   */
  balancesPage(
    session: ClientSession,
    afterId: Types.ObjectId | null,
    limit: number,
  ): Promise<Pick<WorkspaceDoc, '_id' | 'credits'>[]> {
    return WorkspaceModel.find(
      afterId ? { _id: mongoose.trusted({ $gt: afterId }) } : {},
      { credits: 1 },
      { session },
    )
      .sort({ _id: 1 })
      .limit(limit)
      .lean<Pick<WorkspaceDoc, '_id' | 'credits'>[]>()
      .exec();
  },

  /**
   * Atomically adds `delta` to one credit bucket and returns the new balance. With `atLeast`, the
   * update only applies while the bucket holds at least that much (null otherwise). Callers are
   * the credits service only: every change needs its ledger row in the same transaction (06).
   */
  async incCredits(
    session: ClientSession,
    id: string | Types.ObjectId,
    bucket: CreditBucket,
    delta: number,
    atLeast?: number,
  ): Promise<WorkspaceDoc['credits'] | null> {
    const filter: Record<string, unknown> = { _id: oid(id) };
    if (atLeast !== undefined) filter[`credits.${bucket}`] = mongoose.trusted({ $gte: atLeast });
    const ws = await WorkspaceModel.findOneAndUpdate(
      filter,
      { $inc: { [`credits.${bucket}`]: delta } },
      { new: true, session, projection: { credits: 1 } },
    )
      .lean<Pick<WorkspaceDoc, 'credits'>>()
      .exec();
    return ws ? ws.credits : null;
  },
};
