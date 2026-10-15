import {
  DEFAULT_PROVIDER_LIMITS,
  PROVIDER_KEYS,
  RateLimiter,
  type ProviderKey,
  type ProviderLimit,
} from '@pv/engine';
import type { Logger } from '../config/logger';
import type { ErrorReporter } from '../config/sentry';
import { providerSpendRepo, spendDay } from '../modules/providerSpend/repo';

/**
 * Daily spend caps per provider in USD (03 § Cost tracking), unless PROVIDER_DAILY_CAP_USD says
 * otherwise. Sized for the one-user beta: a full 150 × 5 run costs about $36 (2.10 estimate).
 */
export const DEFAULT_DAILY_CAP_USD: Record<ProviderKey, number> = {
  openai: 50,
  perplexity: 25,
  gemini: 25,
  anthropic: 75,
  dataforseo: 15,
};

/** The vendor extractor runs on OpenAI for every check, whatever the platform. */
export const EXTRACTOR_PROVIDER: ProviderKey = 'openai';

export interface ProviderGatesOptions {
  limits?:
    | Partial<Record<ProviderKey, { rpm?: number | undefined; concurrency?: number | undefined }>>
    | undefined;
  capsUsd?: Partial<Record<ProviderKey, number>> | undefined;
  logger: Logger;
  reporter: ErrorReporter;
  /** How often the shared `provider_spend` totals are re-read (other instances spend too). */
  spendRefreshMs?: number;
  now?: () => number;
}

/**
 * Everything that decides whether this instance may claim another job for a provider (04):
 * - the provider's rate limiter (concurrency + RPM token bucket + AIMD on 429),
 * - a quota pause after a `quota` error (15 min),
 * - the daily spend cap: once passed, the provider's jobs wait; they never fail (03).
 * Limits are per instance; during a deploy overlap the totals can briefly double, and the 429
 * handling absorbs that.
 */
export class ProviderGates {
  private readonly limiters = new Map<ProviderKey, RateLimiter>();
  private readonly limits: Record<ProviderKey, ProviderLimit>;
  private readonly capsMicros: Record<ProviderKey, number>;
  private readonly claimed = new Map<string, number>();
  private readonly pausedUntil = new Map<string, number>();
  private spend = new Map<string, number>();
  private spendDayKey = spendDay();
  private spendReadAt = 0;
  private readonly alerted = new Set<string>();
  private readonly now: () => number;

  constructor(private readonly opts: ProviderGatesOptions) {
    this.now = opts.now ?? Date.now;
    this.limits = Object.fromEntries(
      PROVIDER_KEYS.map((p) => {
        const override = opts.limits?.[p];
        return [
          p,
          {
            ...DEFAULT_PROVIDER_LIMITS[p],
            ...(override?.rpm !== undefined ? { rpm: override.rpm } : {}),
            ...(override?.concurrency !== undefined ? { concurrency: override.concurrency } : {}),
          },
        ];
      }),
    ) as Record<ProviderKey, ProviderLimit>;
    this.capsMicros = Object.fromEntries(
      PROVIDER_KEYS.map((p) => [
        p,
        Math.round((opts.capsUsd?.[p] ?? DEFAULT_DAILY_CAP_USD[p]) * 1_000_000),
      ]),
    ) as Record<ProviderKey, number>;
  }

  limiter(provider: ProviderKey): RateLimiter {
    let limiter = this.limiters.get(provider);
    if (!limiter) {
      limiter = new RateLimiter(this.limits[provider], this.now);
      this.limiters.set(provider, limiter);
    }
    return limiter;
  }

  onClaim(provider: string | null): void {
    if (provider) this.claimed.set(provider, (this.claimed.get(provider) ?? 0) + 1);
  }

  onRelease(provider: string | null): void {
    if (provider) this.claimed.set(provider, Math.max(0, (this.claimed.get(provider) ?? 0) - 1));
  }

  /** A `quota` error: stop claiming this provider's jobs here for `ms`, and alert. */
  pause(provider: ProviderKey, ms: number, reason: string): void {
    this.pausedUntil.set(provider, this.now() + ms);
    this.opts.logger.error({ provider, pauseMs: ms, reason }, 'provider quota exhausted; paused');
    this.opts.reporter.capture(new Error(`provider quota exhausted: ${provider}`), {
      provider,
      reason,
    });
  }

  /** Adds a call's cost to today's shared total. Never throws: spend tracking can't fail a check. */
  async recordSpend(provider: ProviderKey, costMicros: number): Promise<void> {
    if (costMicros <= 0) return;
    this.rollDay();
    this.spend.set(provider, (this.spend.get(provider) ?? 0) + costMicros);
    try {
      await providerSpendRepo.add(provider, costMicros);
    } catch (err) {
      this.opts.logger.warn({ err, provider }, 'could not record provider spend');
    }
  }

  /** Re-reads today's totals from Mongo, so every instance sees the others' spend. */
  async refreshSpend(force = false): Promise<void> {
    if (!force && this.now() - this.spendReadAt < (this.opts.spendRefreshMs ?? 30_000)) return;
    this.spendReadAt = this.now();
    this.rollDay();
    try {
      this.spend = await providerSpendRepo.forDay(this.spendDayKey);
    } catch (err) {
      this.opts.logger.warn({ err }, 'could not read provider spend');
    }
  }

  overCap(provider: ProviderKey): boolean {
    const over = (this.spend.get(provider) ?? 0) >= this.capsMicros[provider];
    const key = `${this.spendDayKey}:${provider}`;
    if (over && !this.alerted.has(key)) {
      this.alerted.add(key);
      const capUsd = this.capsMicros[provider] / 1_000_000;
      this.opts.logger.error(
        { provider, capUsd },
        'daily provider spend cap reached; its jobs wait until tomorrow (UTC)',
      );
      this.opts.reporter.capture(new Error(`provider spend cap reached: ${provider}`), {
        provider,
        capUsd,
      });
    }
    return over;
  }

  /**
   * Providers whose jobs must not be claimed right now. When the extractor's provider is over its
   * cap, every check would need it, so every provider is held.
   */
  saturated(): ProviderKey[] {
    const now = this.now();
    if (this.overCap(EXTRACTOR_PROVIDER)) return [...PROVIDER_KEYS];
    return PROVIDER_KEYS.filter(
      (p) =>
        (this.pausedUntil.get(p) ?? 0) > now ||
        (this.claimed.get(p) ?? 0) >= this.limits[p].concurrency ||
        this.limiter(p).saturated ||
        this.overCap(p),
    );
  }

  private rollDay(): void {
    const day = spendDay(new Date(this.now()));
    if (day !== this.spendDayKey) {
      this.spendDayKey = day;
      this.spend = new Map();
    }
  }
}
