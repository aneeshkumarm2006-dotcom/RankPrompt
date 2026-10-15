import {
  PLATFORMS,
  SCHEDULE_FREQUENCIES,
  SCHEDULE_PAUSED_REASONS,
  SCHEDULE_SKIP_REASONS,
  SCOPES,
  type Platform,
  type ScheduleFrequency,
  type SchedulePausedReason,
  type ScheduleSkipReason,
  type Scope,
} from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

export type PausedReason = SchedulePausedReason;

/**
 * `schedules` (02 § Jobs and schedules, 10). `nextRunAt` is the next slot in UTC (null while
 * paused). A tick that claims a slot records it in `inFlight` until the slot's run is created or
 * skipped; an `inFlight` whose lease ran out (the instance died) is picked up again, and the
 * slot's idempotency key keeps that from creating a second run.
 */
export interface ScheduleDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  brandId: Types.ObjectId;
  label: string;
  frequency: ScheduleFrequency;
  hour: number;
  timezone: string;
  weekday: number | null;
  dayOfMonth: number | null;
  platforms: Platform[];
  promptSelection: { mode: 'all_active' | 'fixed'; promptIds: Types.ObjectId[] };
  country: string;
  city: string | null;
  language: string;
  scope: Scope;
  isActive: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastRunId: Types.ObjectId | null;
  consecutiveSkips: number;
  pausedReason: PausedReason | null;
  /** The slot a tick is working on, and until when its claim holds. */
  inFlight: { slot: Date; until: Date } | null;
  lastSkip: { at: Date; reason: ScheduleSkipReason } | null;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSchema = new Schema<ScheduleDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    brandId: { type: Schema.Types.ObjectId, required: true },
    label: { type: String, default: '' },
    frequency: { type: String, enum: SCHEDULE_FREQUENCIES, required: true },
    hour: { type: Number, required: true, min: 0, max: 23 },
    timezone: { type: String, required: true },
    weekday: { type: Number, default: null, min: 0, max: 6 },
    dayOfMonth: { type: Number, default: null, min: 1, max: 28 },
    platforms: { type: [String], enum: PLATFORMS, required: true },
    promptSelection: {
      mode: { type: String, enum: ['all_active', 'fixed'], default: 'all_active' },
      promptIds: { type: [Schema.Types.ObjectId], default: [] },
    },
    country: { type: String, required: true },
    city: { type: String, default: null },
    language: { type: String, required: true },
    scope: { type: String, enum: SCOPES, required: true },
    isActive: { type: Boolean, default: true },
    nextRunAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    lastRunId: { type: Schema.Types.ObjectId, default: null },
    consecutiveSkips: { type: Number, default: 0 },
    pausedReason: { type: String, enum: [...SCHEDULE_PAUSED_REASONS, null], default: null },
    inFlight: {
      type: new Schema({ slot: Date, until: Date }, { _id: false }),
      default: null,
    },
    lastSkip: {
      type: new Schema(
        { at: Date, reason: { type: String, enum: SCHEDULE_SKIP_REASONS } },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);
scheduleSchema.plugin(workspaceScope);
scheduleSchema.index({ isActive: 1, nextRunAt: 1 });
scheduleSchema.index({ workspaceId: 1, brandId: 1 });
scheduleSchema.index(
  { 'inFlight.until': 1 },
  { partialFilterExpression: { 'inFlight.until': { $type: 'date' } } },
);

export const ScheduleModel = mongoose.model<ScheduleDoc>('Schedule', scheduleSchema, 'schedules');
