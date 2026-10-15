import type { Logger } from '../config/logger';
import type { ErrorReporter } from '../config/sentry';
import { schedulesRepo, type ScheduleDoc } from '../modules/schedules/repo';
import type { SchedulesService, SlotOutcome } from '../modules/schedules/service';
import { nextSlotAfter } from '../modules/schedules/timing';

export interface SchedulerOptions {
  schedules: SchedulesService;
  logger: Logger;
  reporter: ErrorReporter;
  /** Tick period (10: 60 s). 0 turns the timer off (tests call `tick` with a fake clock). */
  tickMs?: number;
  /** How long a claimed slot stays claimed before another instance may take it over. */
  claimMs?: number;
  /** Schedules claimed per query. */
  batch?: number;
  now?: () => Date;
}

export interface TickStats {
  claimed: number;
  recovered: number;
  runs: number;
  skipped: number;
  errors: number;
}

const DEFAULT_CLAIM_MS = 5 * 60_000;
/** Bounds one tick, so a backlog is worked off over several ticks instead of one long one. */
const MAX_BATCHES = 20;

/**
 * The scheduler (10 § Scheduler tick), on every instance with RUN_WORKER. Each tick:
 * 1. takes over slots whose claim ran out (an instance died between claiming and finishing);
 * 2. claims due schedules one at a time (claiming advances `nextRunAt` from now, so a slot missed
 *    during downtime runs once, never once per missed slot) and starts or skips each slot's run.
 * Claims are conditional updates and runs have per-slot idempotency keys, so any number of
 * instances can tick at once.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private current: Promise<TickStats> | null = null;
  private readonly claimMs: number;
  private readonly batch: number;

  constructor(private readonly opts: SchedulerOptions) {
    this.claimMs = opts.claimMs ?? DEFAULT_CLAIM_MS;
    this.batch = opts.batch ?? 25;
  }

  start(): void {
    const tickMs = this.opts.tickMs ?? 60_000;
    if (this.timer || tickMs <= 0) return;
    this.timer = setInterval(() => void this.tick(), tickMs);
    this.timer.unref();
    // First tick soon after boot (jittered, so instances started together spread out).
    setTimeout(() => void this.tick(), 1_000 + Math.random() * 2_000).unref();
    this.opts.logger.info({ tickMs }, 'scheduler started');
  }

  /** Stops ticking and waits for a tick in progress (graceful shutdown). */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.current?.catch(() => undefined);
  }

  /** One tick. A tick already running on this instance is joined, not started twice. */
  tick(now?: Date): Promise<TickStats> {
    this.current ??= this.runTick(now ?? this.opts.now?.() ?? new Date()).finally(() => {
      this.current = null;
    });
    return this.current;
  }

  private async runTick(now: Date): Promise<TickStats> {
    const stats: TickStats = { claimed: 0, recovered: 0, runs: 0, skipped: 0, errors: 0 };
    const until = new Date(now.getTime() + this.claimMs);
    try {
      for (const stale of await schedulesRepo.findStale(now, this.batch)) {
        const s = await schedulesRepo.reclaim(stale, until);
        if (!s?.inFlight) continue;
        stats.recovered++;
        this.opts.logger.warn({ scheduleId: s._id, slot: s.inFlight.slot }, 'slot taken over');
        await this.process(s, s.inFlight.slot, stats);
      }

      for (let i = 0; i < MAX_BATCHES; i++) {
        const due = await schedulesRepo.findDue(now, this.batch);
        if (due.length === 0) break;
        let progressed = false;
        for (const candidate of due) {
          const slot = candidate.nextRunAt;
          if (!slot) continue;
          const next = this.nextOrNull(candidate, now);
          if (!next) continue;
          const s = await schedulesRepo.claim(candidate, next, until);
          if (!s) continue;
          progressed = true;
          stats.claimed++;
          await this.process(s, slot, stats);
        }
        if (!progressed) break;
      }
    } catch (err) {
      stats.errors++;
      this.opts.logger.error({ err }, 'scheduler tick failed');
      this.opts.reporter.capture(err, { kind: 'scheduler_tick' });
    }
    if (stats.claimed || stats.recovered || stats.errors) this.opts.logger.info(stats, 'tick');
    return stats;
  }

  private nextOrNull(s: ScheduleDoc, now: Date): Date | null {
    try {
      return nextSlotAfter(s, now);
    } catch (err) {
      // Only reachable with a zone the runtime dropped; the API refuses unknown zones.
      this.opts.logger.error({ err, scheduleId: s._id, timezone: s.timezone }, 'bad schedule');
      return null;
    }
  }

  /** Runs one slot; a failure leaves the claim to expire and be taken over by a later tick. */
  private async process(s: ScheduleDoc, slot: Date, stats: TickStats): Promise<void> {
    let outcome: SlotOutcome;
    try {
      outcome = await this.opts.schedules.runSlot(s, slot);
    } catch (err) {
      stats.errors++;
      this.opts.logger.error({ err, scheduleId: s._id, slot }, 'scheduled slot failed');
      this.opts.reporter.capture(err, { scheduleId: s._id.toHexString() });
      return;
    }
    if (outcome.kind === 'run') stats.runs++;
    if (outcome.kind === 'skipped') stats.skipped++;
  }
}
