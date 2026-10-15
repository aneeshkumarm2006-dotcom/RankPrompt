import { FINAL_RUN_STATUSES, type RunStatus, type RunTrigger } from '@pv/shared';
import { Types, type ClientSession } from 'mongoose';
import { op } from '../../db/trusted';
import { RunModel, type BucketSplit, type RunDoc } from './model';

export type { BucketSplit, RunDoc };

/** Workspace scope: the caller's ctx, or the workspace a job belongs to (worker). */
export interface Scope {
  workspaceId: string | Types.ObjectId;
}

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);
const ws = (scope: Scope) => ({ workspaceId: oid(scope.workspaceId) });
const sess = (session?: ClientSession) => (session ? { session } : {});

export type NewRun = Omit<RunDoc, 'createdAt' | 'updatedAt'>;

/** Statuses a run can still be finalized from (04 § Finalize). */
const FINALIZABLE: RunStatus[] = ['queued', 'running', 'finalizing', 'canceled'];

/** Every query is filtered by workspace (07, layer 1); system sweeps opt out explicitly. */
export const runsRepo = {
  async insert(session: ClientSession, run: NewRun): Promise<void> {
    await RunModel.create([run], { session });
  },

  findById(scope: Scope, id: string | Types.ObjectId, session?: ClientSession) {
    return RunModel.findOne({ ...ws(scope), _id: oid(id) }, null, sess(session))
      .lean<RunDoc>()
      .exec();
  },

  findByIdempotencyKey(scope: Scope, key: string): Promise<RunDoc | null> {
    return RunModel.findOne({ ...ws(scope), idempotencyKey: key })
      .lean<RunDoc>()
      .exec();
  },

  /** Newest first, `_id` cursor. */
  list(
    scope: Scope,
    filter: {
      brandId?: string | undefined;
      status?: RunStatus | undefined;
      trigger?: RunTrigger | undefined;
    },
    cursor: string | undefined,
    limit: number,
  ): Promise<RunDoc[]> {
    return (
      RunModel.find({
        ...ws(scope),
        ...(filter.brandId ? { brandId: oid(filter.brandId) } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.trigger ? { trigger: filter.trigger } : {}),
        ...(cursor ? { _id: op({ $lt: oid(cursor) }) } : {}),
      })
        .sort({ _id: -1 })
        .limit(limit)
        // The list shows total visibility only; the rest of the aggregates stay behind.
        .select({
          'aggregates.byPlatform': 0,
          'aggregates.byCategory': 0,
          'aggregates.competitors': 0,
          'aggregates.suggestedCompetitors': 0,
          'aggregates.topCitedDomains': 0,
        })
        .lean<RunDoc[]>()
        .exec()
    );
  },

  /** The newest run of each brand, for the brands list. */
  async latestPerBrand(scope: Scope): Promise<Map<string, RunDoc>> {
    const rows = await RunModel.aggregate<{ run: RunDoc }>([
      { $match: ws(scope) },
      { $sort: { brandId: 1, createdAt: -1 } },
      { $group: { _id: '$brandId', run: { $first: '$$ROOT' } } },
      { $project: { 'run.aggregates.byCategory': 0, 'run.aggregates.topCitedDomains': 0 } },
    ]);
    return new Map(rows.map((r) => [r.run.brandId.toHexString(), r.run]));
  },

  /** Completed or partial runs of a brand (the ones with aggregates), oldest first. */
  listReportable(
    scope: Scope,
    brandId: string,
    range: { from: Date; to: Date },
    limit = 500,
  ): Promise<RunDoc[]> {
    return RunModel.find({
      ...ws(scope),
      brandId: oid(brandId),
      status: op({ $in: ['completed', 'partial'] }),
      createdAt: op({ $gte: range.from, $lte: range.to }),
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean<RunDoc[]>()
      .exec();
  },

  /** The newest `n` completed or partial runs of a brand, newest first. */
  latestReportable(scope: Scope, brandId: string, n: number): Promise<RunDoc[]> {
    return RunModel.find({
      ...ws(scope),
      brandId: oid(brandId),
      status: op({ $in: ['completed', 'partial'] }),
    })
      .sort({ createdAt: -1 })
      .limit(n)
      .lean<RunDoc[]>()
      .exec();
  },

  /** The schedule's newest finished run before `before` (the scheduled-run email's delta). */
  previousForSchedule(
    scope: Scope,
    scheduleId: Types.ObjectId,
    before: Date,
  ): Promise<RunDoc | null> {
    return RunModel.findOne({
      ...ws(scope),
      scheduleId,
      status: op({ $in: ['completed', 'partial'] }),
      createdAt: op({ $lt: before }),
    })
      .sort({ createdAt: -1 })
      .lean<RunDoc>()
      .exec();
  },

  countForBrand(scope: Scope, brandId: string): Promise<number> {
    return RunModel.countDocuments({ ...ws(scope), brandId: oid(brandId) }).exec();
  },

  /** queued → running on the first check (04). No-op otherwise. */
  async markRunning(scope: Scope, id: Types.ObjectId): Promise<void> {
    await RunModel.updateOne(
      { ...ws(scope), _id: id, status: 'queued' },
      { $set: { status: 'running', startedAt: new Date() } },
    );
  },

  /** queued|running → canceled. False when the run was in any other status. */
  async cancel(scope: Scope, id: string): Promise<boolean> {
    const res = await RunModel.updateOne(
      { ...ws(scope), _id: oid(id), status: op({ $in: ['queued', 'running'] }) },
      { $set: { status: 'canceled', canceledAt: new Date() } },
    );
    return res.modifiedCount === 1;
  },

  /** Claims the run for finalize: queued|running → finalizing. A canceled run keeps its status. */
  async beginFinalize(scope: Scope, id: Types.ObjectId): Promise<void> {
    await RunModel.updateOne(
      { ...ws(scope), _id: id, status: op({ $in: ['queued', 'running'] }) },
      { $set: { status: 'finalizing' } },
    );
  },

  /**
   * Writes the result of finalizing `generation`, only if that generation isn't finalized yet.
   * Runs inside the finalize transaction, together with the refund ledger rows.
   */
  async completeFinalize(
    session: ClientSession,
    scope: Scope,
    id: Types.ObjectId,
    generation: number,
    set: Partial<RunDoc>,
  ): Promise<boolean> {
    const res = await RunModel.updateOne(
      {
        ...ws(scope),
        _id: id,
        generation,
        finalizedGen: op({ $lt: generation }),
        status: op({ $in: FINALIZABLE }),
      },
      { $set: { ...set, finalizedGen: generation } },
      { session },
    );
    return res.modifiedCount === 1;
  },

  /** Admin recompute: replaces counts and aggregates, nothing else. */
  async setAggregates(
    scope: Scope,
    id: Types.ObjectId,
    set: Pick<RunDoc, 'counts' | 'aggregates' | 'metricsVersion' | 'costMicros' | 'models'>,
  ): Promise<void> {
    await RunModel.updateOne({ ...ws(scope), _id: id }, { $set: set });
  },

  /**
   * Admin rerun: a final run goes back to `running` as a new generation, with the extra credits
   * it reserved. Conditional on the generation it was read at, so two reruns can't interleave.
   */
  async beginRerun(
    session: ClientSession,
    scope: Scope,
    id: Types.ObjectId,
    fromGeneration: number,
    reserved: { total: number; split: BucketSplit },
  ): Promise<boolean> {
    const res = await RunModel.updateOne(
      {
        ...ws(scope),
        _id: id,
        generation: fromGeneration,
        finalizedGen: fromGeneration,
        status: op({ $in: ['completed', 'partial', 'failed'] }),
      },
      {
        $set: { status: 'running', finishedAt: null },
        $inc: {
          generation: 1,
          'credits.reserved': reserved.total,
          'credits.split.plan': reserved.split.plan,
          'credits.split.purchased': reserved.split.purchased,
        },
      },
      { session },
    );
    return res.modifiedCount === 1;
  },

  /** Deletes a run that is final (04 § Delete). False when it isn't, or doesn't exist. */
  async deleteFinal(session: ClientSession, scope: Scope, id: string): Promise<boolean> {
    const res = await RunModel.deleteOne(
      {
        ...ws(scope),
        _id: oid(id),
        status: op({ $in: FINAL_RUN_STATUSES }),
        $expr: op({ $gte: ['$finalizedGen', '$generation'] }),
      },
      { session },
    );
    return res.deletedCount === 1;
  },

  // ---- System sweeps (sweeper; cross-workspace, reviewed) -----------------------------------

  /** Runs that still need finalizing and haven't changed since `before`. */
  findUnfinalized(before: Date, limit: number): Promise<RunDoc[]> {
    return RunModel.find({
      status: op({ $in: FINALIZABLE }),
      updatedAt: op({ $lt: before }),
      $expr: op({ $lt: ['$finalizedGen', '$generation'] }),
    })
      .setOptions({ crossWorkspace: true })
      .select({ _id: 1, workspaceId: 1, status: 1, generation: 1, finalizedGen: 1 })
      .limit(limit)
      .lean<RunDoc[]>()
      .exec();
  },

  /** Runs still `queued` since before `before` (nothing has picked them up). */
  findStuckQueued(before: Date, limit: number): Promise<RunDoc[]> {
    return RunModel.find({ status: 'queued', createdAt: op({ $lt: before }) })
      .setOptions({ crossWorkspace: true })
      .select({ _id: 1, workspaceId: 1, createdAt: 1 })
      .limit(limit)
      .lean<RunDoc[]>()
      .exec();
  },

  /** Admin scripts look a run up by id alone. */
  findAnyById(id: string): Promise<RunDoc | null> {
    return RunModel.findOne({ _id: oid(id) })
      .setOptions({ crossWorkspace: true })
      .lean<RunDoc>()
      .exec();
  },
};
