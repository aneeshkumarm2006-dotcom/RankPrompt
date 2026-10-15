import mongoose, { Schema, type Types } from 'mongoose';

export const JOB_TYPES = ['check', 'finalize_run', 'reconcile_ledger', 'send_email'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed', 'canceled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * `jobs` (02 § Jobs, D-009): the MongoDB-backed queue. A system collection, not owned by one
 * workspace, so it has no workspace-scope plugin; `workspaceId` is there for the fairness cap.
 */
export interface JobDoc {
  _id: Types.ObjectId;
  type: JobType;
  payload: Record<string, unknown>;
  workspaceId: Types.ObjectId | null;
  /** The run a job belongs to, so cancel and delete can find its jobs. */
  runId: Types.ObjectId | null;
  /** The provider limiter this job waits on (`openai`, `perplexity`, …), or null. */
  providerKey: string | null;
  status: JobStatus;
  /** The next time the job can be claimed. */
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  /** Fencing token: a new one on every claim. Writes by an older lease are refused. */
  leaseId: Types.ObjectId | null;
  lockedBy: string | null;
  lockedUntil: Date | null;
  lastError: string | null;
  /** Unique when set: stops the same job being enqueued twice (`finalize:<runId>`). */
  dedupeKey?: string;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const FINISHED_JOB_TTL_SECONDS = 14 * 24 * 60 * 60;

const jobSchema = new Schema<JobDoc>(
  {
    type: { type: String, enum: JOB_TYPES, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    workspaceId: { type: Schema.Types.ObjectId, default: null },
    runId: { type: Schema.Types.ObjectId, default: null },
    providerKey: { type: String, default: null },
    status: { type: String, enum: JOB_STATUSES, required: true, default: 'queued' },
    runAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    leaseId: { type: Schema.Types.ObjectId, default: null },
    lockedBy: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null },
    // No default: only jobs that set it take part in the unique index.
    dedupeKey: { type: String },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);
jobSchema.index({ status: 1, runAt: 1 });
jobSchema.index({ status: 1, lockedUntil: 1 });
jobSchema.index({ runId: 1, status: 1 });
jobSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
jobSchema.index(
  { finishedAt: 1 },
  {
    expireAfterSeconds: FINISHED_JOB_TTL_SECONDS,
    partialFilterExpression: { status: { $in: ['done', 'canceled'] } },
  },
);

export const JobModel = mongoose.model<JobDoc>('Job', jobSchema, 'jobs');
