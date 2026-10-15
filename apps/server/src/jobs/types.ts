import type { Types } from 'mongoose';
import type { JobDoc, JobType } from './repo';

export interface JobContext {
  /** The claimed job (`attempts` already counts this attempt). */
  job: JobDoc;
  leaseId: Types.ObjectId;
  /**
   * Aborted when the lease is lost, the instance shuts down, or (tests) the worker is killed.
   * Once aborted, a handler must not write anything and should return `abandoned`.
   */
  signal: AbortSignal;
}

export type JobOutcome =
  /** Finished; the job is marked done. */
  | { kind: 'done' }
  /** Try again after `delayMs`. `refundAttempt` gives back the attempt this claim used. */
  | { kind: 'retry'; delayMs: number; refundAttempt: boolean; error: string }
  /** Gave up for good; the job is marked failed. */
  | { kind: 'failed'; error: string }
  /** Lost the lease or was interrupted: the queue writes nothing for this claim. */
  | { kind: 'abandoned' };

export interface JobHandler {
  type: JobType;
  run(ctx: JobContext): Promise<JobOutcome>;
  /**
   * The queue gave up on a job without the handler deciding (its attempts ran out on unexpected
   * errors or expired leases). Puts whatever the job was working on into a final state.
   */
  onGiveUp?(job: JobDoc, error: string): Promise<void>;
}

export const DONE: JobOutcome = { kind: 'done' };
export const ABANDONED: JobOutcome = { kind: 'abandoned' };
