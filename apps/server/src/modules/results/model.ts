import { CHECK_STATUSES, PLATFORMS, type CheckStatus, type Platform } from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

export const RESULT_SCHEMA_VERSION = 1;

export interface ResultCitation {
  url: string;
  domain: string;
  title: string | null;
  position: number;
}

export interface ResultCompetitor {
  competitorId: Types.ObjectId;
  name: string;
  mentioned: boolean;
  rank: number | null;
  cited: boolean;
}

/**
 * `run_results` (02): one per check (prompt × platform). Written by the check worker with a fenced
 * update: `leaseId` is the job lease that currently owns the check, and only that lease may write
 * the outcome (04 § Lease renewal and fencing).
 */
export interface ResultDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  runId: Types.ObjectId;
  brandId: Types.ObjectId;
  promptId: Types.ObjectId;
  promptText: string;
  category: string;
  platform: Platform;
  status: CheckStatus;
  answer: string;
  citations: ResultCitation[];
  vendors: string[];
  /** Vendors matching neither the brand nor a tracked competitor (suggested competitors, 05). */
  suggested: string[];
  brand: {
    mentioned: boolean;
    rank: number | null;
    cited: boolean;
    citedUrl: string | null;
    snippet: string | null;
  };
  competitors: ResultCompetitor[];
  model: string;
  latencyMs: number;
  costMicros: number;
  attempts: number;
  /** `message` is internal (provider text); the API shows a safe message per `code`. */
  error: { code: string; message: string } | null;
  leaseId: Types.ObjectId | null;
  engineVersion: string | null;
  schemaVersion: number;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema<ResultDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    runId: { type: Schema.Types.ObjectId, required: true },
    brandId: { type: Schema.Types.ObjectId, required: true },
    promptId: { type: Schema.Types.ObjectId, required: true },
    promptText: { type: String, required: true },
    category: { type: String, default: '' },
    platform: { type: String, enum: PLATFORMS, required: true },
    status: { type: String, enum: CHECK_STATUSES, required: true },
    answer: { type: String, default: '' },
    citations: {
      type: [
        new Schema(
          {
            url: { type: String, required: true },
            domain: { type: String, default: '' },
            title: { type: String, default: null },
            position: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    vendors: { type: [String], default: [] },
    suggested: { type: [String], default: [] },
    brand: {
      mentioned: { type: Boolean, default: false },
      rank: { type: Number, default: null },
      cited: { type: Boolean, default: false },
      citedUrl: { type: String, default: null },
      snippet: { type: String, default: null },
    },
    competitors: {
      type: [
        new Schema(
          {
            competitorId: { type: Schema.Types.ObjectId, required: true },
            name: { type: String, required: true },
            mentioned: { type: Boolean, default: false },
            rank: { type: Number, default: null },
            cited: { type: Boolean, default: false },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    model: { type: String, default: '' },
    latencyMs: { type: Number, default: 0 },
    costMicros: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    error: {
      type: new Schema({ code: String, message: String }, { _id: false }),
      default: null,
    },
    leaseId: { type: Schema.Types.ObjectId, default: null },
    engineVersion: { type: String, default: null },
    schemaVersion: { type: Number, default: RESULT_SCHEMA_VERSION },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);
resultSchema.plugin(workspaceScope);
resultSchema.index({ runId: 1, status: 1 });
resultSchema.index({ workspaceId: 1, runId: 1, platform: 1 });
resultSchema.index({ workspaceId: 1, brandId: 1, promptId: 1, createdAt: -1 });
resultSchema.index({ workspaceId: 1, brandId: 1, createdAt: -1 });

export const ResultModel = mongoose.model<ResultDoc>('RunResult', resultSchema, 'run_results');

/** `run_result_raw` (02): provider request/response, kept 30 days (TTL). */
export interface RawDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  runId: Types.ObjectId;
  resultId: Types.ObjectId;
  provider: string;
  response: unknown;
  extractorResponse: unknown;
  createdAt: Date;
}

export const RAW_TTL_SECONDS = 30 * 24 * 60 * 60;

const rawSchema = new Schema<RawDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    runId: { type: Schema.Types.ObjectId, required: true },
    resultId: { type: Schema.Types.ObjectId, required: true },
    provider: { type: String, required: true },
    response: { type: Schema.Types.Mixed, default: null },
    extractorResponse: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);
rawSchema.plugin(workspaceScope);
rawSchema.index({ resultId: 1 });
rawSchema.index({ workspaceId: 1, runId: 1 });
rawSchema.index({ createdAt: 1 }, { expireAfterSeconds: RAW_TTL_SECONDS });

export const RawModel = mongoose.model<RawDoc>('RunResultRaw', rawSchema, 'run_result_raw');
