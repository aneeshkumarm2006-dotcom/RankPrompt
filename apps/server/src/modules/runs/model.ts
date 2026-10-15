import {
  PLATFORMS,
  RUN_STATUSES,
  RUN_TRIGGERS,
  SCOPES,
  type CountryCode,
  type LanguageCode,
  type Platform,
  type RunAggregates,
  type RunStatus,
  type RunTrigger,
  type Scope,
} from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

export interface BucketSplit {
  plan: number;
  purchased: number;
}

/**
 * `runs` (02 § Runs and results). One execution of N prompts × M platforms.
 *
 * Credits (06): `credits.split` is what was reserved from each bucket and `credits.refundedSplit`
 * what finalize gave back, both cumulative. An admin rerun of failed checks reserves again as a
 * new `generation`; finalize runs once per generation (`finalizedGen`), so every ledger row has a
 * unique key and a repeated finalize can't refund twice.
 */
export interface RunDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  brandId: Types.ObjectId;
  trigger: RunTrigger;
  scheduleId: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
  idempotencyKey: string;
  config: {
    platforms: Platform[];
    country: CountryCode;
    city: string | null;
    language: LanguageCode;
    scope: Scope;
    aioLoadAsync: boolean;
  };
  /** Frozen at creation so later brand edits don't change old results. */
  brandSnapshot: {
    name: string;
    domain: string;
    aliases: string[];
    competitors: { _id: Types.ObjectId; name: string; domain: string; aliases: string[] }[];
  };
  promptIds: Types.ObjectId[];
  /** Trend comparability (05): sha1 of the sorted prompt ids / platforms. */
  promptSetHash: string;
  platformsHash: string;
  status: RunStatus;
  /** Written at finalize. Live progress is counted from `run_results` on read (04). */
  counts: { total: number; ok: number; noAnswer: number; failed: number; canceled: number };
  credits: {
    reserved: number;
    charged: number;
    refunded: number;
    split: BucketSplit;
    refundedSplit: BucketSplit;
  };
  aggregates: RunAggregates | null;
  engineVersion: string;
  metricsVersion: string | null;
  models: Partial<Record<Platform, string>>;
  costMicros: number;
  generation: number;
  finalizedGen: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  canceledAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const int = { type: Number, default: 0, validate: Number.isInteger };
const split = { plan: int, purchased: int };

const runSchema = new Schema<RunDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    brandId: { type: Schema.Types.ObjectId, required: true },
    trigger: { type: String, enum: RUN_TRIGGERS, required: true },
    scheduleId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    idempotencyKey: { type: String, required: true },
    config: {
      platforms: { type: [String], enum: PLATFORMS, required: true },
      country: { type: String, required: true },
      city: { type: String, default: null },
      language: { type: String, required: true },
      scope: { type: String, enum: SCOPES, required: true },
      aioLoadAsync: { type: Boolean, default: false },
    },
    brandSnapshot: {
      name: { type: String, required: true },
      domain: { type: String, required: true },
      aliases: { type: [String], default: [] },
      competitors: {
        type: [
          new Schema({
            name: { type: String, required: true },
            domain: { type: String, required: true },
            aliases: { type: [String], default: [] },
          }),
        ],
        default: [],
      },
    },
    promptIds: { type: [Schema.Types.ObjectId], default: [] },
    promptSetHash: { type: String, required: true },
    platformsHash: { type: String, required: true },
    status: { type: String, enum: RUN_STATUSES, required: true },
    counts: { total: int, ok: int, noAnswer: int, failed: int, canceled: int },
    credits: { reserved: int, charged: int, refunded: int, split, refundedSplit: split },
    aggregates: { type: Schema.Types.Mixed, default: null },
    engineVersion: { type: String, required: true },
    metricsVersion: { type: String, default: null },
    models: { type: Schema.Types.Mixed, default: {} },
    costMicros: int,
    generation: { type: Number, default: 1 },
    finalizedGen: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);
runSchema.plugin(workspaceScope);
runSchema.index({ workspaceId: 1, idempotencyKey: 1 }, { unique: true });
runSchema.index({ workspaceId: 1, brandId: 1, createdAt: -1 });
runSchema.index({ workspaceId: 1, createdAt: -1 });
runSchema.index({ status: 1, updatedAt: 1 });
runSchema.index({ scheduleId: 1, createdAt: -1 });

export const RunModel = mongoose.model<RunDoc>('Run', runSchema, 'runs');
