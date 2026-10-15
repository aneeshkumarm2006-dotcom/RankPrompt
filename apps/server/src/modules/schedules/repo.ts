import type { ScheduleSkipReason } from '@pv/shared';
import { Types, type ClientSession } from 'mongoose';
import type { Ctx } from '../../http/context';
import { op } from '../../db/trusted';
import { ScheduleModel, type PausedReason, type ScheduleDoc } from './model';

export type { PausedReason, ScheduleDoc };

type Scope = Pick<Ctx, 'workspaceId'>;

const oid = (id: string | Types.ObjectId) => new Types.ObjectId(id);
const ws = (scope: Scope) => ({ workspaceId: oid(scope.workspaceId) });

/** The scheduler works across workspaces (07: system code opts out explicitly, reviewed). */
const SYSTEM = { crossWorkspace: true } as const;

export type NewSchedule = Omit<
  ScheduleDoc,
  | '_id'
  | 'isActive'
  | 'lastRunAt'
  | 'lastRunId'
  | 'consecutiveSkips'
  | 'pausedReason'
  | 'inFlight'
  | 'lastSkip'
  | 'createdAt'
  | 'updatedAt'
>;

export type SchedulePatch = Partial<
  Pick<
    ScheduleDoc,
    | 'label'
    | 'frequency'
    | 'hour'
    | 'timezone'
    | 'weekday'
    | 'dayOfMonth'
    | 'platforms'
    | 'promptSelection'
    | 'country'
    | 'city'
    | 'language'
    | 'scope'
    | 'nextRunAt'
  >
>;

export const schedulesRepo = {
  // ---- Owner reads and writes (workspace-scoped) ---------------------------------------------

  listForBrand(scope: Scope, brandId: string): Promise<ScheduleDoc[]> {
    return ScheduleModel.find({ ...ws(scope), brandId: oid(brandId) })
      .sort({ createdAt: 1, _id: 1 })
      .lean<ScheduleDoc[]>()
      .exec();
  },

  findById(scope: Scope, id: string): Promise<ScheduleDoc | null> {
    return ScheduleModel.findOne({ ...ws(scope), _id: oid(id) })
      .lean<ScheduleDoc>()
      .exec();
  },

  countForBrand(scope: Scope, brandId: string): Promise<number> {
    return ScheduleModel.countDocuments({ ...ws(scope), brandId: oid(brandId) }).exec();
  },

  async insert(schedule: NewSchedule): Promise<ScheduleDoc> {
    const doc = await ScheduleModel.create(schedule);
    return doc.toObject<ScheduleDoc>();
  },

  update(scope: Scope, id: string, patch: SchedulePatch): Promise<ScheduleDoc | null> {
    return ScheduleModel.findOneAndUpdate(
      { ...ws(scope), _id: oid(id) },
      { $set: patch },
      { new: true },
    )
      .lean<ScheduleDoc>()
      .exec();
  },

  /** Pauses an active schedule (`user`). A paused one is returned as it is. */
  async pause(scope: Scope, id: string): Promise<ScheduleDoc | null> {
    await ScheduleModel.updateOne(
      { ...ws(scope), _id: oid(id), isActive: true },
      { $set: { isActive: false, pausedReason: 'user', nextRunAt: null } },
    );
    return this.findById(scope, id);
  },

  /** Resumes with a fresh `nextRunAt` and a clean skip count (08). */
  resume(scope: Scope, id: string, nextRunAt: Date): Promise<ScheduleDoc | null> {
    return ScheduleModel.findOneAndUpdate(
      { ...ws(scope), _id: oid(id) },
      {
        $set: {
          isActive: true,
          pausedReason: null,
          nextRunAt,
          consecutiveSkips: 0,
          lastSkip: null,
        },
      },
      { new: true },
    )
      .lean<ScheduleDoc>()
      .exec();
  },

  async remove(scope: Scope, id: string): Promise<boolean> {
    const res = await ScheduleModel.deleteOne({ ...ws(scope), _id: oid(id) });
    return res.deletedCount === 1;
  },

  /** A run started by "run now" becomes the schedule's last run. */
  async recordRun(scope: Scope, id: Types.ObjectId, runId: Types.ObjectId): Promise<void> {
    await ScheduleModel.updateOne(
      { ...ws(scope), _id: id },
      { $set: { lastRunId: runId, lastRunAt: new Date() } },
    );
  },

  /** Deactivates every active schedule of a brand (used when the brand is archived). */
  async pauseAllForBrand(
    ctx: Ctx,
    brandId: string,
    reason: PausedReason,
    session: ClientSession,
  ): Promise<number> {
    const res = await ScheduleModel.updateMany(
      { workspaceId: oid(ctx.workspaceId), brandId: oid(brandId), isActive: true },
      { $set: { isActive: false, pausedReason: reason, nextRunAt: null } },
      { session },
    );
    return res.modifiedCount;
  },

  /** The next time any active schedule of the brand runs, or null. */
  async nextRunAt(ctx: Pick<Ctx, 'workspaceId'>, brandId: string): Promise<Date | null> {
    const next = await ScheduleModel.findOne({
      workspaceId: oid(ctx.workspaceId),
      brandId: oid(brandId),
      isActive: true,
      nextRunAt: op({ $type: 'date' }),
    })
      .sort({ nextRunAt: 1 })
      .select({ nextRunAt: 1 })
      .lean<{ nextRunAt: Date | null }>()
      .exec();
    return next?.nextRunAt ?? null;
  },

  /** Active schedule count per brand, for the brands list. */
  async countActiveByBrand(ctx: Pick<Ctx, 'workspaceId'>): Promise<Map<string, number>> {
    const rows = await ScheduleModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { workspaceId: oid(ctx.workspaceId), isActive: true } },
      { $group: { _id: '$brandId', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toHexString(), r.n]));
  },

  // ---- Scheduler (system, across workspaces) -------------------------------------------------

  /** Active schedules whose slot is due and that no tick is working on, oldest first. */
  findDue(now: Date, limit: number): Promise<ScheduleDoc[]> {
    return ScheduleModel.find(
      { isActive: true, nextRunAt: op({ $lte: now }), inFlight: null },
      null,
      SYSTEM,
    )
      .sort({ nextRunAt: 1, _id: 1 })
      .limit(limit)
      .lean<ScheduleDoc[]>()
      .exec();
  },

  /**
   * Claims the due slot (10 § Scheduler tick): advances `nextRunAt` and records the slot in
   * `inFlight`, in one conditional update. Only one instance can match the old `nextRunAt`, so
   * only one wins a slot. Null when another instance (or a user edit) got there first.
   */
  claim(s: ScheduleDoc, next: Date, leaseUntil: Date): Promise<ScheduleDoc | null> {
    if (!s.nextRunAt) return Promise.resolve(null);
    return ScheduleModel.findOneAndUpdate(
      { _id: s._id, isActive: true, nextRunAt: s.nextRunAt, inFlight: null },
      { $set: { nextRunAt: next, inFlight: { slot: s.nextRunAt, until: leaseUntil } } },
      { new: true, ...SYSTEM },
    )
      .lean<ScheduleDoc>()
      .exec();
  },

  /** Slots whose claim ran out before their run was created or skipped (an instance died). */
  findStale(now: Date, limit: number): Promise<ScheduleDoc[]> {
    return ScheduleModel.find({ 'inFlight.until': op({ $lt: now }) }, null, SYSTEM)
      .sort({ 'inFlight.until': 1 })
      .limit(limit)
      .lean<ScheduleDoc[]>()
      .exec();
  },

  /** Takes over a stale slot (same slot, new lease). Null if someone else took it or finished it. */
  reclaim(s: ScheduleDoc, leaseUntil: Date): Promise<ScheduleDoc | null> {
    if (!s.inFlight) return Promise.resolve(null);
    return ScheduleModel.findOneAndUpdate(
      { _id: s._id, 'inFlight.slot': s.inFlight.slot, 'inFlight.until': s.inFlight.until },
      { $set: { 'inFlight.until': leaseUntil } },
      { new: true, ...SYSTEM },
    )
      .lean<ScheduleDoc>()
      .exec();
  },

  /** The slot's run exists: clear the claim and the skip streak. Fenced on the slot. */
  async finishWithRun(id: Types.ObjectId, slot: Date, runId: Types.ObjectId): Promise<boolean> {
    const res = await ScheduleModel.updateOne(
      { _id: id, 'inFlight.slot': slot },
      {
        $set: {
          inFlight: null,
          consecutiveSkips: 0,
          lastSkip: null,
          lastRunId: runId,
          lastRunAt: new Date(),
        },
      },
    ).setOptions(SYSTEM);
    return res.modifiedCount === 1;
  },

  /**
   * The slot was skipped: clear the claim and record why. A credit skip adds to the streak that
   * auto-pauses the schedule. Fenced on the slot, so a slot is counted once. Returns the updated
   * schedule, or null when this slot was already finished.
   */
  finishWithSkip(
    id: Types.ObjectId,
    slot: Date,
    reason: ScheduleSkipReason,
    countsTowardPause: boolean,
  ): Promise<ScheduleDoc | null> {
    return ScheduleModel.findOneAndUpdate(
      { _id: id, 'inFlight.slot': slot },
      {
        $set: { inFlight: null, lastSkip: { at: new Date(), reason } },
        $inc: { consecutiveSkips: countsTowardPause ? 1 : 0 },
      },
      { new: true, ...SYSTEM },
    )
      .lean<ScheduleDoc>()
      .exec();
  },

  /** Drops the claim without recording a run or a skip (the schedule was paused meanwhile). */
  async release(id: Types.ObjectId, slot: Date): Promise<void> {
    await ScheduleModel.updateOne(
      { _id: id, 'inFlight.slot': slot },
      { $set: { inFlight: null } },
    ).setOptions(SYSTEM);
  },

  /** Auto-pause after too many credit skips. True for the call that paused it. */
  async autoPause(id: Types.ObjectId, reason: PausedReason): Promise<boolean> {
    const res = await ScheduleModel.updateOne(
      { _id: id, isActive: true },
      { $set: { isActive: false, pausedReason: reason, nextRunAt: null } },
    ).setOptions(SYSTEM);
    return res.modifiedCount === 1;
  },

  /** Admin and tests: one schedule by id, any workspace. */
  findAnyById(id: string | Types.ObjectId): Promise<ScheduleDoc | null> {
    return ScheduleModel.findOne({ _id: oid(id) }, null, SYSTEM)
      .lean<ScheduleDoc>()
      .exec();
  },
};
