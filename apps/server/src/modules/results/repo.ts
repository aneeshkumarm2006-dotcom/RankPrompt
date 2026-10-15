import type { CheckStatus, MetricCheck, Platform } from '@pv/shared';
import { Types, type ClientSession } from 'mongoose';
import { op } from '../../db/trusted';
import {
  RawModel,
  ResultModel,
  type RawDoc,
  type ResultCitation,
  type ResultCompetitor,
  type ResultDoc,
} from './model';

export type { RawDoc, ResultCitation, ResultCompetitor, ResultDoc };
export { RESULT_SCHEMA_VERSION } from './model';

export interface Scope {
  workspaceId: string | Types.ObjectId;
}

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);
const ws = (scope: Scope) => ({ workspaceId: oid(scope.workspaceId) });

/** A check that hasn't reached a final status yet. */
export const OPEN_STATUSES: CheckStatus[] = ['pending', 'running'];

export type StatusCounts = Record<CheckStatus, number>;
const zeroCounts = (): StatusCounts => ({
  pending: 0,
  running: 0,
  ok: 0,
  no_answer: 0,
  failed: 0,
  canceled: 0,
});

export type NewResult = Omit<ResultDoc, '_id' | 'createdAt' | 'updatedAt'> & {
  _id: Types.ObjectId;
};

/** What a successful or failed check writes (fenced). */
export type ResultOutcome = Pick<
  ResultDoc,
  | 'status'
  | 'answer'
  | 'citations'
  | 'vendors'
  | 'suggested'
  | 'brand'
  | 'competitors'
  | 'model'
  | 'latencyMs'
  | 'costMicros'
  | 'attempts'
  | 'error'
  | 'engineVersion'
>;

const METRIC_FIELDS = {
  promptId: 1,
  category: 1,
  platform: 1,
  status: 1,
  'brand.mentioned': 1,
  'brand.rank': 1,
  'brand.cited': 1,
  competitors: 1,
  vendors: 1,
  suggested: 1,
  'citations.domain': 1,
  'citations.url': 1,
} as const;

type MetricRow = Pick<
  ResultDoc,
  '_id' | 'promptId' | 'category' | 'platform' | 'status' | 'competitors' | 'vendors' | 'suggested'
> & {
  brand: Pick<ResultDoc['brand'], 'mentioned' | 'rank' | 'cited'>;
  citations: Pick<ResultCitation, 'domain' | 'url'>[];
};

export const toMetricCheck = (r: MetricRow): MetricCheck => ({
  promptId: r.promptId.toHexString(),
  category: r.category,
  platform: r.platform,
  status: r.status,
  brand: { mentioned: r.brand.mentioned, rank: r.brand.rank, cited: r.brand.cited },
  competitors: r.competitors.map((c) => ({
    competitorId: c.competitorId.toHexString(),
    mentioned: c.mentioned,
    rank: c.rank,
    cited: c.cited,
  })),
  vendors: r.vendors,
  suggested: r.suggested,
  citations: r.citations.map((c) => ({ domain: c.domain, url: c.url })),
});

export interface ResultFilter {
  platform?: Platform | undefined;
  category?: string | undefined;
  status?: CheckStatus | undefined;
  mentioned?: boolean | undefined;
}

async function statusCountsMany(
  scope: Scope,
  runIds: readonly Types.ObjectId[],
): Promise<Map<string, StatusCounts>> {
  const out = new Map<string, StatusCounts>(runIds.map((id) => [id.toHexString(), zeroCounts()]));
  if (!runIds.length) return out;
  const rows = await ResultModel.aggregate<{
    _id: { runId: Types.ObjectId; status: CheckStatus };
    n: number;
  }>([
    { $match: { ...ws(scope), runId: { $in: [...runIds] } } },
    { $group: { _id: { runId: '$runId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  for (const row of rows) {
    const counts = out.get(row._id.runId.toHexString());
    if (counts) counts[row._id.status] = row.n;
  }
  return out;
}

/** Every query is filtered by workspace (07, layer 1). */
export const resultsRepo = {
  async insertMany(session: ClientSession, results: readonly NewResult[]): Promise<void> {
    await ResultModel.insertMany(results, { session });
  },

  findById(scope: Scope, id: string | Types.ObjectId): Promise<ResultDoc | null> {
    return ResultModel.findOne({ ...ws(scope), _id: oid(id) })
      .lean<ResultDoc>()
      .exec();
  },

  /**
   * Takes the check for a job lease: pending|running → running with this lease. A check that is
   * already final can't be taken (another lease finished it, or the run was canceled).
   */
  async markRunning(
    scope: Scope,
    id: Types.ObjectId,
    leaseId: Types.ObjectId,
    attempts: number,
  ): Promise<boolean> {
    const res = await ResultModel.updateOne(
      { ...ws(scope), _id: id, status: op({ $in: OPEN_STATUSES }) },
      { $set: { status: 'running', leaseId, attempts } },
    );
    return res.matchedCount === 1;
  },

  /** Back to pending while its job waits for a retry. Fenced on the lease. */
  async releaseToPending(scope: Scope, id: Types.ObjectId, leaseId: Types.ObjectId) {
    const res = await ResultModel.updateOne(
      { ...ws(scope), _id: id, status: 'running', leaseId },
      { $set: { status: 'pending' } },
    );
    return res.matchedCount === 1;
  },

  /**
   * The fenced write (04): only the lease that currently owns the running check may store its
   * outcome. A worker that lost its lease writes nothing, so a check is stored exactly once.
   */
  async writeOutcome(
    scope: Scope,
    id: Types.ObjectId,
    leaseId: Types.ObjectId,
    outcome: ResultOutcome,
  ): Promise<boolean> {
    const res = await ResultModel.updateOne(
      { ...ws(scope), _id: id, status: 'running', leaseId },
      { $set: { ...outcome, finishedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  },

  /** Final failure when the job itself gave up (no lease to fence on any more). */
  async failIfOpen(scope: Scope, id: Types.ObjectId, error: { code: string; message: string }) {
    const res = await ResultModel.updateOne(
      { ...ws(scope), _id: id, status: op({ $in: OPEN_STATUSES }) },
      { $set: { status: 'failed', error, finishedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  },

  async cancelIfOpen(scope: Scope, id: Types.ObjectId): Promise<boolean> {
    const res = await ResultModel.updateOne(
      { ...ws(scope), _id: id, status: op({ $in: OPEN_STATUSES }) },
      { $set: { status: 'canceled', finishedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  },

  /** Cancels these open checks of a run (their jobs were canceled, so nothing will run them). */
  async cancelOpen(scope: Scope, runId: string, ids: readonly Types.ObjectId[]): Promise<number> {
    if (!ids.length) return 0;
    const res = await ResultModel.updateMany(
      {
        ...ws(scope),
        runId: oid(runId),
        _id: op({ $in: ids }),
        status: op({ $in: OPEN_STATUSES }),
      },
      { $set: { status: 'canceled', finishedAt: new Date() } },
    );
    return res.modifiedCount;
  },

  countOpen(scope: Scope, runId: Types.ObjectId): Promise<number> {
    return ResultModel.countDocuments({
      ...ws(scope),
      runId,
      status: op({ $in: OPEN_STATUSES }),
    }).exec();
  },

  /** Live progress, counted on read (04 § Progress). */
  async statusCounts(scope: Scope, runId: Types.ObjectId): Promise<StatusCounts> {
    return (await statusCountsMany(scope, [runId])).get(runId.toHexString()) ?? zeroCounts();
  },

  statusCountsMany: (scope: Scope, runIds: readonly Types.ObjectId[]) =>
    statusCountsMany(scope, runIds),

  /** Every check of a run, trimmed to what the metrics need. */
  async metricChecks(scope: Scope, runId: Types.ObjectId): Promise<MetricCheck[]> {
    const rows = await ResultModel.find({ ...ws(scope), runId })
      .select(METRIC_FIELDS)
      .sort({ _id: 1 })
      .lean<MetricRow[]>()
      .exec();
    return rows.map(toMetricCheck);
  },

  /** Cost and the answering model per platform, summed over a run's checks. */
  async costAndModels(
    scope: Scope,
    runId: Types.ObjectId,
  ): Promise<{ costMicros: number; models: Partial<Record<Platform, string>> }> {
    const rows = await ResultModel.aggregate<{
      _id: Platform;
      cost: number;
      models: string[];
    }>([
      { $match: { ...ws(scope), runId } },
      {
        $group: {
          _id: '$platform',
          cost: { $sum: '$costMicros' },
          models: { $addToSet: '$model' },
        },
      },
    ]);
    const models: Partial<Record<Platform, string>> = {};
    for (const r of rows) {
      const names = r.models.filter(Boolean).sort();
      if (names.length) models[r._id] = names.join(', ');
    }
    return { costMicros: rows.reduce((s, r) => s + r.cost, 0), models };
  },

  /** `GET /runs/:id/results`: filters, `_id` cursor, in check order. */
  list(
    scope: Scope,
    runId: string,
    filter: ResultFilter,
    cursor: string | undefined,
    limit: number,
  ): Promise<ResultDoc[]> {
    return ResultModel.find({
      ...ws(scope),
      runId: oid(runId),
      ...(filter.platform ? { platform: filter.platform } : {}),
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.mentioned !== undefined ? { 'brand.mentioned': filter.mentioned } : {}),
      ...(cursor ? { _id: op({ $gt: oid(cursor) }) } : {}),
    })
      .sort({ _id: 1 })
      .limit(limit)
      .select({ leaseId: 0 })
      .lean<ResultDoc[]>()
      .exec();
  },

  /** Every check of a run, for exports and the public report. */
  listAll(scope: Scope, runId: Types.ObjectId): Promise<ResultDoc[]> {
    return ResultModel.find({ ...ws(scope), runId })
      .sort({ _id: 1 })
      .lean<ResultDoc[]>()
      .exec();
  },

  /** Admin rerun: failed checks go back to pending. Returns the checks reset. */
  async resetFailed(
    session: ClientSession,
    scope: Scope,
    runId: Types.ObjectId,
  ): Promise<Pick<ResultDoc, '_id' | 'platform'>[]> {
    const failed = await ResultModel.find(
      { ...ws(scope), runId, status: 'failed' },
      { _id: 1, platform: 1 },
      { session },
    )
      .lean<Pick<ResultDoc, '_id' | 'platform'>[]>()
      .exec();
    if (failed.length) {
      await ResultModel.updateMany(
        { ...ws(scope), runId, _id: op({ $in: failed.map((r) => r._id) }), status: 'failed' },
        { $set: { status: 'pending', error: null, leaseId: null, finishedAt: null } },
        { session },
      );
    }
    return failed;
  },

  /** Check counts per platform and status, with error codes (admin inspect-run). */
  breakdown(scope: Scope, runId: Types.ObjectId) {
    return ResultModel.aggregate<{
      _id: { platform: Platform; status: CheckStatus; error: string | null };
      n: number;
      attempts: number;
    }>([
      { $match: { ...ws(scope), runId } },
      {
        $group: {
          _id: { platform: '$platform', status: '$status', error: '$error.code' },
          n: { $sum: 1 },
          attempts: { $sum: '$attempts' },
        },
      },
      { $sort: { '_id.platform': 1, '_id.status': 1 } },
    ]);
  },

  // ---- Insights ------------------------------------------------------------------------------

  /** A brand's checks in a time range, trimmed for the prompt history. */
  history(
    scope: Scope,
    brandId: string,
    range: { from: Date; to: Date },
    runIds: readonly Types.ObjectId[],
  ) {
    return ResultModel.find({
      ...ws(scope),
      brandId: oid(brandId),
      runId: op({ $in: [...runIds] }),
      createdAt: op({ $gte: range.from, $lte: range.to }),
    })
      .select({
        runId: 1,
        promptId: 1,
        platform: 1,
        status: 1,
        'brand.mentioned': 1,
        'brand.rank': 1,
        'brand.cited': 1,
      })
      .lean<
        (Pick<ResultDoc, 'runId' | 'promptId' | 'platform' | 'status'> & {
          brand: Pick<ResultDoc['brand'], 'mentioned' | 'rank' | 'cited'>;
        })[]
      >()
      .exec();
  },

  /** Cited domains over a brand's answered checks in a range (05 § Sources). */
  async sources(
    scope: Scope,
    brandId: string,
    range: { from: Date; to: Date },
    platform: Platform | undefined,
    limit: number,
  ): Promise<{
    total: number;
    domains: {
      domain: string;
      count: number;
      platforms: Platform[];
      urls: string[];
      prompts: string[];
    }[];
  }> {
    const match = {
      ...ws(scope),
      brandId: oid(brandId),
      status: 'ok',
      createdAt: { $gte: range.from, $lte: range.to },
      ...(platform ? { platform } : {}),
    };
    const [rows] = await ResultModel.aggregate<{
      total: { n: number }[];
      domains: {
        _id: string;
        count: number;
        platforms: Platform[];
        urls: string[];
        prompts: string[];
      }[];
    }>([
      { $match: match },
      { $unwind: '$citations' },
      { $match: { 'citations.domain': { $ne: '' } } },
      {
        $facet: {
          total: [{ $count: 'n' }],
          domains: [
            {
              $group: {
                _id: { $toLower: '$citations.domain' },
                count: { $sum: 1 },
                platforms: { $addToSet: '$platform' },
                urls: { $addToSet: '$citations.url' },
                prompts: { $addToSet: '$promptText' },
              },
            },
            { $sort: { count: -1, _id: 1 } },
            { $limit: limit },
            {
              $project: {
                count: 1,
                platforms: 1,
                urls: { $slice: ['$urls', 3] },
                prompts: { $slice: ['$prompts', 3] },
              },
            },
          ],
        },
      },
    ]);
    return {
      total: rows?.total[0]?.n ?? 0,
      domains: (rows?.domains ?? []).map((d) => ({
        domain: d._id,
        count: d.count,
        platforms: d.platforms,
        urls: d.urls,
        prompts: d.prompts,
      })),
    };
  },

  // ---- Raw payloads (30-day TTL) -------------------------------------------------------------

  async insertRaw(raw: Omit<RawDoc, '_id' | 'createdAt'>): Promise<void> {
    await RawModel.create(raw);
  },

  findRaw(scope: Scope, resultId: Types.ObjectId): Promise<RawDoc | null> {
    return RawModel.findOne({ ...ws(scope), resultId })
      .lean<RawDoc>()
      .exec();
  },

  async deleteForRun(session: ClientSession, scope: Scope, runId: Types.ObjectId) {
    await RawModel.deleteMany({ ...ws(scope), runId }, { session });
    await ResultModel.deleteMany({ ...ws(scope), runId }, { session });
  },
};
