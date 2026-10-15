import type { ProviderKey } from './types';

export interface ProviderLimit {
  /** Requests per minute; omitted = unlimited. */
  rpm?: number;
  /** Requests in flight at once. */
  concurrency: number;
}

/**
 * 429s closer together than this count as one congestion signal: requests that were already in
 * flight when the provider started throttling all fail at once, and halving once per failure would
 * take the rate from hundreds a minute to 1 in a single burst.
 */
export const RATE_DECREASE_COOLDOWN_MS = 2_000;

/**
 * Per-instance defaults (04). Perplexity's Agent API allows about 1 request/s at tier 0 and
 * concurrent bursts caused 429s in the luna runs, so it gets a strict RPM bucket.
 * Concurrency is sized so the RPM bucket is what binds: a slot is held for the answer plus the
 * vendor extraction, so `concurrency ≈ rpm × (answer + extract seconds) / 60` with headroom
 * (the 8.1 load test, D-027). Claude with web search takes ~25 s, so 4 slots would have capped it
 * at about 8 checks a minute against its 50 RPM. Override with PROVIDER_LIMITS.
 */
export const DEFAULT_PROVIDER_LIMITS: Record<ProviderKey, ProviderLimit> = {
  openai: { concurrency: 24, rpm: 400 },
  perplexity: { concurrency: 10, rpm: 45 },
  gemini: { concurrency: 12, rpm: 120 },
  anthropic: { concurrency: 32, rpm: 50 },
  dataforseo: { concurrency: 16, rpm: 600 },
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason as Error);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });

/**
 * Concurrency gate plus an RPM token bucket with AIMD: a 429 halves the rate, each success
 * adds a little back up to the configured maximum (04 § Retry policy).
 */
export class RateLimiter {
  private inFlight = 0;
  private readonly waiters: (() => void)[] = [];
  private readonly maxRpm: number | undefined;
  private rpm: number | undefined;
  private tokens: number;
  private refilledAt: number;
  private decreasedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly limit: ProviderLimit,
    private readonly now: () => number = Date.now,
  ) {
    this.maxRpm = limit.rpm;
    this.rpm = limit.rpm;
    this.tokens = Math.min(limit.rpm ?? 0, limit.concurrency);
    this.refilledAt = now();
  }

  get currentRpm(): number | undefined {
    return this.rpm;
  }

  /** True when a new request would have to wait (used by the queue's saturation filter). */
  get saturated(): boolean {
    this.refill();
    return this.inFlight >= this.limit.concurrency || (this.rpm !== undefined && this.tokens < 1);
  }

  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      return await fn();
    } finally {
      this.inFlight--;
      this.waiters.shift()?.();
    }
  }

  /** A 429: halve the rate, at most once per cooldown (one burst of 429s is one signal). */
  onRateLimited(): void {
    const now = this.now();
    this.tokens = Math.min(this.tokens, 0);
    if (now - this.decreasedAt < RATE_DECREASE_COOLDOWN_MS) return;
    this.decreasedAt = now;
    if (this.rpm !== undefined) this.rpm = Math.max(1, Math.floor(this.rpm / 2));
    else this.rpm = 30;
  }

  onSuccess(): void {
    if (this.rpm === undefined) return;
    if (this.maxRpm === undefined) {
      this.rpm += 1;
      if (this.rpm > 600) this.rpm = undefined;
    } else this.rpm = Math.min(this.maxRpm, this.rpm + 1);
  }

  private refill(): void {
    const now = this.now();
    if (this.rpm !== undefined) {
      const burst = Math.max(1, Math.min(this.rpm, this.limit.concurrency));
      this.tokens = Math.min(burst, this.tokens + ((now - this.refilledAt) / 60_000) * this.rpm);
    }
    this.refilledAt = now;
  }

  private async acquire(signal?: AbortSignal): Promise<void> {
    while (this.inFlight >= this.limit.concurrency) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.inFlight++;
    try {
      for (;;) {
        this.refill();
        if (this.rpm === undefined) return;
        if (this.tokens >= 1) {
          this.tokens -= 1;
          return;
        }
        await sleep(Math.ceil(((1 - this.tokens) / this.rpm) * 60_000), signal);
      }
    } catch (e) {
      this.inFlight--;
      this.waiters.shift()?.();
      throw e;
    }
  }
}
