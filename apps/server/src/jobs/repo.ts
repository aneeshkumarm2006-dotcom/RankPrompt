import { Types, type ClientSession } from 'mongoose';
import { isDuplicateKeyError } from '../db/errors';
import { op } from '../db/trusted';
import { JobModel, type JobDoc, type JobStatus, type JobType } from './model';

export type { JobDoc, JobStatus, JobType };

export interface NewJob {
  type: JobType;
  payload: Record<string, unknown>;
  workspaceId: Types.ObjectId | null;
  runId?: Types.ObjectId | null;
  providerKey?: string | null;
  runAt?: Date;
  maxAttempts?: number;
  dedupeKey?: string;
}

const toDoc = (job: NewJob, now: Date) => ({
  type: job.type,
  payload: job.payload,
  workspaceId: job.workspaceId,
  runId: job.runId ?? null,
  providerKey: job.providerKey ?? null,
  status: 'queued' as const,
  runAt: job.runAt ?? now,
  attempts: 0,
  maxAttempts: job.maxAttempts ?? 5,
  ...(job.dedupeKey ? { dedupeKey: job.dedupeKey } : {}),
});

/** Clears the lease fields when a job leaves `running`. */
const unlock = { leaseId: null, lockedBy: null, lockedUntil: null };

/**
 * The queue's storage (04 § Queue mechanics). Every state change is one conditional, atomic update,
 * and every change to a running job is fenced on its `leaseId`, so two instances can share it.
 */
export const jobsRepo = {
  async insertMany(session: ClientSession, jobs: readonly NewJob[]): Promise<void> {
    const now = new Date();
    await JobModel.insertMany(
      jobs.map((j) => toDoc(j, now)),
      { session },
    );
  },

  /**
   * Enqueues a job with a `dedupeKey` at most once. If the earlier job with that key already
   * finished (done or failed), it is queued again: finalize can be needed again after an admin
   * rerun, and a failed finalize must be retryable. A queued or running one is left alone.
   */
  async enqueueUnique(job: NewJob & { dedupeKey: string }): Promise<void> {
    const now = new Date();
    try {
      await JobModel.updateOne(
        { dedupeKey: job.dedupeKey },
        { $setOnInsert: toDoc(job, now) },
        { upsert: true },
      );
    } catch (err) {
      // Two instances upserting the same key at once: the other one inserted it.
      if (!isDuplicateKeyError(err)) throw err;
    }
    await JobModel.updateOne(
      { dedupeKey: job.dedupeKey, status: op({ $in: ['done', 'failed'] }) },
      {
        $set: { status: 'queued', runAt: now, attempts: 0, lastError: null, finishedAt: null },
      },
    );
  },

  /**
   * Enqueues a job with a `dedupeKey` unless one with that key was ever enqueued (finished ones
   * included), so a once-a-day job runs once that day however many instances ask for it.
   */
  async enqueueOnce(job: NewJob & { dedupeKey: string }): Promise<boolean> {
    try {
      const res = await JobModel.updateOne(
        { dedupeKey: job.dedupeKey },
        { $setOnInsert: toDoc(job, new Date()) },
        { upsert: true },
      );
      return res.upsertedCount === 1;
    } catch (err) {
      if (isDuplicateKeyError(err)) return false;
      throw err;
    }
  },

  /**
   * Atomically claims the oldest due job (04 § Claim): queued → running with a fresh lease.
   * Saturated providers and workspaces are left out, and so is each workspace that already holds
   * its fair share of a provider (`excludePairs`), so one big run can't starve the others.
   */
  claim(opts: {
    types: readonly JobType[];
    instanceId: string;
    leaseMs: number;
    excludeProviders: readonly string[];
    excludeWorkspaces: readonly Types.ObjectId[];
    excludePairs?: readonly { workspaceId: Types.ObjectId; providerKey: string }[];
    now?: Date;
  }): Promise<JobDoc | null> {
    const now = opts.now ?? new Date();
    const pairs = opts.excludePairs ?? [];
    return JobModel.findOneAndUpdate(
      {
        status: 'queued',
        runAt: op({ $lte: now }),
        type: op({ $in: [...opts.types] }),
        ...(opts.excludeProviders.length
          ? { providerKey: op({ $nin: [...opts.excludeProviders] }) }
          : {}),
        ...(opts.excludeWorkspaces.length
          ? { workspaceId: op({ $nin: [...opts.excludeWorkspaces] }) }
          : {}),
        ...(pairs.length
          ? {
              $nor: pairs.map((p) => ({ workspaceId: p.workspaceId, providerKey: p.providerKey })),
            }
          : {}),
      },
      {
        $set: {
          status: 'running',
          leaseId: new Types.ObjectId(),
          lockedBy: opts.instanceId,
          lockedUntil: new Date(now.getTime() + opts.leaseMs),
        },
        $inc: { attempts: 1 },
      },
      { sort: { runAt: 1, _id: 1 }, new: true },
    )
      .lean<JobDoc>()
      .exec();
  },

  /**
   * For each provider, the workspaces with a due job waiting for it (fair shares, 04 § Claim).
   * One small aggregate on the `{status, runAt}` index, run every few seconds per instance.
   */
  async waitingByProvider(now = new Date()): Promise<Map<string, Set<string>>> {
    const rows = await JobModel.aggregate<{ _id: { p: string; w: Types.ObjectId } }>([
      {
        $match: {
          status: 'queued',
          runAt: { $lte: now },
          providerKey: { $ne: null },
          workspaceId: { $ne: null },
        },
      },
      { $group: { _id: { p: '$providerKey', w: '$workspaceId' } } },
    ]);
    const out = new Map<string, Set<string>>();
    for (const { _id } of rows) {
      const set = out.get(_id.p) ?? new Set<string>();
      set.add(_id.w.toHexString());
      out.set(_id.p, set);
    }
    return out;
  },

  /** Extends the lease. False means the lease was lost: the holder must stop and write nothing. */
  async renew(id: Types.ObjectId, leaseId: Types.ObjectId, leaseMs: number): Promise<boolean> {
    const res = await JobModel.updateOne(
      { _id: id, leaseId, status: 'running' },
      { $set: { lockedUntil: new Date(Date.now() + leaseMs) } },
    );
    return res.matchedCount === 1;
  },

  /** Still held by this lease? Checked right before a handler writes its result. */
  async holds(id: Types.ObjectId, leaseId: Types.ObjectId): Promise<boolean> {
    return (await JobModel.countDocuments({ _id: id, leaseId, status: 'running' })) === 1;
  },

  async complete(id: Types.ObjectId, leaseId: Types.ObjectId): Promise<boolean> {
    const res = await JobModel.updateOne(
      { _id: id, leaseId, status: 'running' },
      { $set: { status: 'done', finishedAt: new Date(), ...unlock } },
    );
    return res.matchedCount === 1;
  },

  /**
   * Back to the queue at `runAt`. `refundAttempt` gives back the attempt the claim used (a rate
   * limit with Retry-After, a quota pause, a shutdown).
   */
  async requeue(
    id: Types.ObjectId,
    leaseId: Types.ObjectId,
    runAt: Date,
    opts: { refundAttempt?: boolean; lastError?: string | null } = {},
  ): Promise<boolean> {
    const res = await JobModel.updateOne(
      { _id: id, leaseId, status: 'running' },
      {
        $set: {
          status: 'queued',
          runAt,
          ...unlock,
          ...(opts.lastError !== undefined ? { lastError: opts.lastError } : {}),
        },
        ...(opts.refundAttempt ? { $inc: { attempts: -1 } } : {}),
      },
    );
    return res.matchedCount === 1;
  },

  async fail(id: Types.ObjectId, leaseId: Types.ObjectId, lastError: string): Promise<boolean> {
    const res = await JobModel.updateOne(
      { _id: id, leaseId, status: 'running' },
      { $set: { status: 'failed', lastError, finishedAt: new Date(), ...unlock } },
    );
    return res.matchedCount === 1;
  },

  /**
   * Lease recovery (04 § Sweeper): puts an expired running job back in the queue, or fails it when
   * it has no attempts left. Conditional on the lease still being expired, so a holder that just
   * renewed keeps its job. Returns what happened, or null when the job moved on.
   */
  async recoverExpired(job: JobDoc, now: Date): Promise<'requeued' | 'failed' | null> {
    const filter = {
      _id: job._id,
      leaseId: job.leaseId,
      status: 'running',
      lockedUntil: op({ $lt: now }),
    };
    if (job.attempts >= job.maxAttempts) {
      const res = await JobModel.updateOne(filter, {
        $set: {
          status: 'failed',
          lastError: 'lease expired on the last attempt',
          finishedAt: now,
          ...unlock,
        },
      });
      return res.matchedCount === 1 ? 'failed' : null;
    }
    const res = await JobModel.updateOne(filter, {
      $set: { status: 'queued', runAt: now, lastError: 'lease expired', ...unlock },
    });
    return res.matchedCount === 1 ? 'requeued' : null;
  },

  /**
   * Replaces one payload field once a job no longer needs it (a sent email's verify or reset link
   * shouldn't sit in the jobs collection for the 14 days a finished job is kept).
   */
  async redactPayload(id: Types.ObjectId, field: string): Promise<void> {
    await JobModel.updateOne({ _id: id }, { $set: { [`payload.${field}`]: { redacted: true } } });
  },

  /** Running jobs whose lease ran out (their worker died or stalled). */
  findExpired(now: Date, limit: number): Promise<JobDoc[]> {
    return JobModel.find({ status: 'running', lockedUntil: op({ $lt: now }) })
      .limit(limit)
      .lean<JobDoc[]>()
      .exec();
  },

  // ---- Runs ----------------------------------------------------------------------------------

  /**
   * Cancels a run's queued check jobs and returns the result ids whose jobs are now canceled
   * (including any canceled by an earlier call), so the caller can cancel those checks.
   */
  async cancelQueuedChecks(runId: Types.ObjectId): Promise<Types.ObjectId[]> {
    await JobModel.updateMany(
      { runId, type: 'check', status: 'queued' },
      { $set: { status: 'canceled', finishedAt: new Date(), ...unlock } },
    );
    const canceled = await JobModel.find(
      { runId, type: 'check', status: 'canceled' },
      { payload: 1 },
    )
      .lean<Pick<JobDoc, 'payload'>[]>()
      .exec();
    return canceled
      .map((j) => j.payload.resultId)
      .filter((id): id is string => typeof id === 'string')
      .map((id) => new Types.ObjectId(id));
  },

  async deleteForRun(session: ClientSession, runId: Types.ObjectId): Promise<void> {
    await JobModel.deleteMany({ runId }, { session });
  },

  /** Job counts per type and status for one run (admin inspect-run). */
  async countsForRun(runId: Types.ObjectId): Promise<Record<string, number>> {
    const rows = await JobModel.aggregate<{ _id: { type: string; status: string }; n: number }>([
      { $match: { runId } },
      { $group: { _id: { type: '$type', status: '$status' }, n: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [`${r._id.type}:${r._id.status}`, r.n]));
  },

  findById(id: Types.ObjectId): Promise<JobDoc | null> {
    return JobModel.findById(id).lean<JobDoc>().exec();
  },

  /** Jobs that are due now (tests and the stuck-run alert). */
  countDue(filter: { runId?: Types.ObjectId } = {}): Promise<number> {
    return JobModel.countDocuments({
      status: 'queued',
      runAt: op({ $lte: new Date() }),
      ...(filter.runId ? { runId: filter.runId } : {}),
    }).exec();
  },
};
