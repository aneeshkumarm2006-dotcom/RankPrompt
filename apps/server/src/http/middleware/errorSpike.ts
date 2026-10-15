import type { Logger } from '../../config/logger';
import type { ErrorReporter } from '../../config/sentry';

/**
 * The 5xx spike alert (CHECKLIST P8): every 5xx is already logged and reported one by one; this
 * adds one error-level line (and a Sentry event, if set) when `threshold` of them land within
 * `windowMs`, at most once per window. Per instance, in memory.
 */
export class ErrorSpikeAlarm {
  private times: number[] = [];
  private alertedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly deps: {
      logger: Logger;
      reporter: ErrorReporter;
      threshold?: number;
      windowMs?: number;
      now?: () => number;
    },
  ) {}

  record(): void {
    const now = this.deps.now?.() ?? Date.now();
    const windowMs = this.deps.windowMs ?? 5 * 60_000;
    const threshold = this.deps.threshold ?? 10;
    this.times = this.times.filter((t) => now - t < windowMs);
    this.times.push(now);
    if (this.times.length < threshold || now - this.alertedAt < windowMs) return;
    this.alertedAt = now;
    const minutes = windowMs / 60_000;
    this.deps.logger.error(
      { count: this.times.length, windowMinutes: minutes },
      `5xx spike: ${this.times.length} server errors in ${minutes} minutes`,
    );
    this.deps.reporter.capture(new Error('5xx spike'), {
      count: this.times.length,
      windowMinutes: minutes,
    });
  }
}
