import { retryDecision } from '@pv/engine';
import { Types } from 'mongoose';
import type { Logger } from '../config/logger';
import type { ErrorReporter } from '../config/sentry';
import type { ProviderGates } from './providerGates';
import { jobsRepo, type JobDoc, type JobType } from './repo';
import { sweep, type SweepOptions, type SweepStats } from './sweeper';
import type { JobHandler, JobOutcome } from './types';

export interface WorkerOptions {
  instanceId: string;
  handlers: readonly JobHandler[];
  gates: ProviderGates;
  logger: Logger;
  reporter: ErrorReporter;
  /** Jobs this instance runs at once. */
  concurrency: number;
  /** In-flight cap per workspace on this instance (an upper bound; fair shares apply below it). */
  maxInflightPerWorkspace: number;
  /** How often the workspaces waiting for each provider are re-read (fair shares, 04). */
  fairRefreshMs?: number;
  /** Lease length; renewed every `renewMs` while a handler runs (04: 60 s / 15 s). */
  leaseMs?: number;
  renewMs?: number;
  /** Idle wait between claims when nothing is due. */
  pollMs?: number;
  /** Sweeper period (04: 60 s). 0 turns it off (tests drive `sweep` directly). */
  sweepMs?: number;
  sweep?: Partial<SweepOptions>;
  /** Multiplies every retry delay. Tests shrink it; production leaves it at 1. */
  delayScale?: number;
}

interface Inflight {
  job: JobDoc;
  controller: AbortController;
  done: Promise<void>;
}

const SHUTDOWN = 'shutdown';
const KILLED = 'killed';
const LEASE_LOST = 'lease lost';

const errorText = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

/**
 * The job worker (04): claims due jobs from Mongo within the provider and workspace limits, runs
 * each under a renewed lease, and applies the handler's outcome with writes fenced on that lease.
 * Every state change is atomic in Mongo, so several instances can run it at once.
 */
export class Worker {
  private readonly handlers: Map<JobType, JobHandler>;
  private readonly inflight = new Map<string, Inflight>();
  private readonly perWorkspace = new Map<string, number>();
  /** In-flight jobs per `workspaceId|providerKey`. */
  private readonly perPair = new Map<string, number>();
  private waiting = new Map<string, Set<string>>();
  private waitingReadAt = 0;
  private readonly leaseMs: number;
  private readonly renewMs: number;
  private readonly pollMs: number;
  private stopping = false;
  private killed = false;
  private loopDone: Promise<void> | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private wakeIdle: (() => void) | null = null;
  private slotWaiters: (() => void)[] = [];
  private lastBeat = Date.now();

  constructor(private readonly opts: WorkerOptions) {
    this.handlers = new Map(opts.handlers.map((h) => [h.type, h]));
    this.leaseMs = opts.leaseMs ?? 60_000;
    this.renewMs = opts.renewMs ?? 15_000;
    this.pollMs = opts.pollMs ?? 1_000;
  }

  get instanceId(): string {
    return this.opts.instanceId;
  }

  /** Milliseconds since the claim loop last ran (readiness probe). */
  heartbeatAgeMs(): number {
    return Date.now() - this.lastBeat;
  }

  get inflightCount(): number {
    return this.inflight.size;
  }

  start(): void {
    if (this.loopDone) return;
    this.loopDone = this.loop();
    const sweepMs = this.opts.sweepMs ?? 60_000;
    if (sweepMs > 0) {
      this.sweepTimer = setInterval(() => void this.sweepNow(), sweepMs);
      this.sweepTimer.unref();
    }
    this.opts.logger.info({ instanceId: this.opts.instanceId }, 'worker started');
  }

  /** New jobs were enqueued: skip the rest of the idle wait. */
  wake(): void {
    this.wakeIdle?.();
  }

  /** One sweeper pass (04). Null when it failed; the failure is logged. */
  async sweepNow(): Promise<SweepStats | null> {
    try {
      return await sweep({
        handlers: this.handlers,
        logger: this.opts.logger,
        reporter: this.opts.reporter,
        ...this.opts.sweep,
      });
    } catch (err) {
      this.opts.logger.error({ err }, 'sweep failed');
      return null;
    }
  }

  /**
   * Graceful shutdown (04): stop claiming, let in-flight handlers finish within `graceMs`, then
   * abort the rest and put their jobs back in the queue (attempt refunded, due now).
   */
  async drain(graceMs: number): Promise<void> {
    this.stop();
    await this.loopDone;
    const all = () => Promise.all([...this.inflight.values()].map((i) => i.done));
    const timedOut = await Promise.race([
      all().then(() => false),
      new Promise<boolean>((r) => setTimeout(() => r(true), graceMs).unref()),
    ]);
    if (timedOut) {
      this.opts.logger.warn({ jobs: this.inflight.size }, 'grace period over; releasing jobs');
      for (const i of this.inflight.values()) i.controller.abort(SHUTDOWN);
      await all();
    }
    this.opts.logger.info({ instanceId: this.opts.instanceId }, 'worker drained');
  }

  /**
   * Tests only: behave like a process that died. Stops at once and writes nothing more; its jobs
   * keep their leases until they expire and the sweeper recovers them.
   */
  async kill(): Promise<void> {
    this.killed = true;
    this.stop();
    for (const i of this.inflight.values()) i.controller.abort(KILLED);
    await this.loopDone;
    await Promise.all([...this.inflight.values()].map((i) => i.done));
  }

  /** Stops claiming and unblocks the loop wherever it waits. */
  private stop(): void {
    this.stopping = true;
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.wake();
    for (const release of this.slotWaiters.splice(0)) release();
  }

  // ---- Claim loop ----------------------------------------------------------------------------

  private async loop(): Promise<void> {
    while (!this.stopping) {
      this.lastBeat = Date.now();
      if (this.inflight.size >= this.opts.concurrency) {
        await new Promise<void>((r) => this.slotWaiters.push(r));
        continue;
      }
      let job: JobDoc | null = null;
      try {
        await this.opts.gates.refreshSpend();
        await this.refreshWaiting();
        const saturated = this.saturatedWorkspaces();
        job = await jobsRepo.claim({
          types: [...this.handlers.keys()],
          instanceId: this.opts.instanceId,
          leaseMs: this.leaseMs,
          excludeProviders: this.opts.gates.saturated(),
          excludeWorkspaces: saturated,
          excludePairs: this.overFairShare(saturated),
        });
      } catch (err) {
        if (this.stopping) break;
        this.opts.logger.error({ err }, 'job claim failed');
      }
      if (this.stopping) {
        // Claimed while shutting down: hand it straight back (a killed worker writes nothing).
        if (job?.leaseId && !this.killed) {
          await jobsRepo.requeue(job._id, job.leaseId, new Date(), { refundAttempt: true });
        }
        break;
      }
      if (job) this.execute(job);
      else await this.idle();
    }
  }

  private idle(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, this.pollMs * (0.75 + Math.random() * 0.5));
      function done() {
        clearTimeout(timer);
        resolve();
      }
      this.wakeIdle = () => {
        this.wakeIdle = null;
        done();
      };
    });
  }

  private saturatedWorkspaces(): Types.ObjectId[] {
    const out: Types.ObjectId[] = [];
    for (const i of this.inflight.values()) {
      const ws = i.job.workspaceId;
      if (
        ws &&
        (this.perWorkspace.get(ws.toHexString()) ?? 0) >= this.opts.maxInflightPerWorkspace
      ) {
        if (!out.some((o) => o.equals(ws))) out.push(ws);
      }
    }
    return out;
  }

  private async refreshWaiting(): Promise<void> {
    const now = Date.now();
    if (now - this.waitingReadAt < (this.opts.fairRefreshMs ?? 2_000)) return;
    this.waitingReadAt = now;
    try {
      this.waiting = await jobsRepo.waitingByProvider(new Date(now));
    } catch (err) {
      this.opts.logger.warn({ err }, 'could not read the waiting workspaces');
    }
  }

  /**
   * Fair shares (04 § Claim). Claims are oldest-first, so on their own the oldest run would take
   * every free slot of a slow or rate-limited provider and the other runs would wait for it to
   * finish. So when several workspaces want the same provider, only those with the fewest of its
   * jobs in flight on this instance may claim the next one: the slots (and the RPM tokens) go
   * round-robin. A workspace alone on a provider may use all of it.
   */
  private overFairShare(
    saturated: readonly Types.ObjectId[],
  ): { workspaceId: Types.ObjectId; providerKey: string }[] {
    const blocked = new Set(saturated.map((w) => w.toHexString()));
    const holders = new Map<string, Map<string, number>>();
    for (const [key, n] of this.perPair) {
      const [ws = '', provider = ''] = key.split('|');
      const byWs = holders.get(provider) ?? new Map<string, number>();
      byWs.set(ws, n);
      holders.set(provider, byWs);
    }
    const out: { workspaceId: Types.ObjectId; providerKey: string }[] = [];
    for (const [provider, byWs] of holders) {
      const counts = new Map(byWs);
      for (const ws of this.waiting.get(provider) ?? []) if (!counts.has(ws)) counts.set(ws, 0);
      for (const ws of blocked) counts.delete(ws);
      if (counts.size < 2) continue;
      const fewest = Math.min(...counts.values());
      for (const [ws, n] of byWs) {
        if (n > fewest) out.push({ workspaceId: new Types.ObjectId(ws), providerKey: provider });
      }
    }
    return out;
  }

  // ---- Running one job -----------------------------------------------------------------------

  private execute(job: JobDoc): void {
    const id = job._id.toHexString();
    const ws = job.workspaceId?.toHexString();
    const controller = new AbortController();
    this.opts.gates.onClaim(job.providerKey);
    if (ws) this.perWorkspace.set(ws, (this.perWorkspace.get(ws) ?? 0) + 1);
    const pair = ws && job.providerKey ? `${ws}|${job.providerKey}` : null;
    if (pair) this.perPair.set(pair, (this.perPair.get(pair) ?? 0) + 1);

    const done = this.runJob(job, controller)
      .catch((err: unknown) => {
        this.opts.logger.error({ err, jobId: id }, 'job bookkeeping failed');
      })
      .finally(() => {
        this.inflight.delete(id);
        this.opts.gates.onRelease(job.providerKey);
        if (ws) this.perWorkspace.set(ws, Math.max(0, (this.perWorkspace.get(ws) ?? 1) - 1));
        if (pair) {
          const left = (this.perPair.get(pair) ?? 1) - 1;
          if (left > 0) this.perPair.set(pair, left);
          else this.perPair.delete(pair);
        }
        this.slotWaiters.shift()?.();
      });
    this.inflight.set(id, { job, controller, done });
  }

  private async runJob(job: JobDoc, controller: AbortController): Promise<void> {
    const leaseId = job.leaseId;
    const handler = this.handlers.get(job.type);
    if (!leaseId || !handler) return;

    const renew = setInterval(() => {
      jobsRepo.renew(job._id, leaseId, this.leaseMs).then(
        (held) => {
          if (!held && !controller.signal.aborted) controller.abort(LEASE_LOST);
        },
        (err: unknown) => this.opts.logger.warn({ err, jobId: job._id }, 'lease renewal failed'),
      );
    }, this.renewMs);
    renew.unref();

    let outcome: JobOutcome;
    try {
      outcome = await handler.run({ job, leaseId, signal: controller.signal });
    } catch (err) {
      outcome = this.unexpected(job, err);
    } finally {
      clearInterval(renew);
    }

    if (this.killed) return;
    if (outcome.kind === 'abandoned' && controller.signal.reason === SHUTDOWN) {
      await jobsRepo.requeue(job._id, leaseId, new Date(), { refundAttempt: true });
      return;
    }
    await this.apply(job, leaseId, handler, outcome);
  }

  /** An exception the handler didn't turn into an outcome: back off, or give up when out of attempts. */
  private unexpected(job: JobDoc, err: unknown): JobOutcome {
    this.opts.logger.error({ err, jobId: job._id, type: job.type }, 'job handler threw');
    const error = errorText(err);
    if (job.attempts >= job.maxAttempts) return { kind: 'failed', error };
    return {
      kind: 'retry',
      delayMs: retryDecision('transient', job.attempts).delayMs,
      refundAttempt: false,
      error,
    };
  }

  private async apply(
    job: JobDoc,
    leaseId: Types.ObjectId,
    handler: JobHandler,
    outcome: JobOutcome,
  ): Promise<void> {
    switch (outcome.kind) {
      case 'done':
        await jobsRepo.complete(job._id, leaseId);
        return;
      case 'retry': {
        const delay = Math.round(outcome.delayMs * (this.opts.delayScale ?? 1));
        await jobsRepo.requeue(job._id, leaseId, new Date(Date.now() + delay), {
          refundAttempt: outcome.refundAttempt,
          lastError: outcome.error,
        });
        return;
      }
      case 'failed':
        if (await jobsRepo.fail(job._id, leaseId, outcome.error)) {
          this.opts.logger.error(
            { jobId: job._id.toHexString(), type: job.type, error: outcome.error },
            'job failed after its last attempt',
          );
          this.opts.reporter.capture(new Error(`job ${job.type} failed: ${outcome.error}`), {
            jobId: job._id.toHexString(),
          });
          await handler.onGiveUp?.(job, outcome.error);
        }
        return;
      case 'abandoned':
        return;
    }
  }
}
