import type { ProviderErrorKind } from './errors';

/**
 * The retry policy by `ProviderError.kind` (04 § Retry policy). Shared by the CLI runner and,
 * from P4, the job queue.
 */
export const MAX_ATTEMPTS = 5;
const TRANSIENT_BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000];
export const QUOTA_PAUSE_MS = 15 * 60_000;

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  /** False when the retry shouldn't use up an attempt (rate limit with Retry-After, quota). */
  countsAsAttempt: boolean;
}

const jitter = (ms: number, random: () => number) => Math.round(ms * (0.8 + 0.4 * random()));

/** `attempt` is the 1-based attempt that just failed. */
export function retryDecision(
  kind: ProviderErrorKind,
  attempt: number,
  retryAfterMs?: number,
  random: () => number = Math.random,
): RetryDecision {
  const backoff = jitter(
    TRANSIENT_BACKOFF_MS[Math.min(attempt, TRANSIENT_BACKOFF_MS.length) - 1] ?? 300_000,
    random,
  );
  switch (kind) {
    case 'rate_limited':
      return {
        retry: retryAfterMs !== undefined || attempt < MAX_ATTEMPTS,
        delayMs: Math.max(retryAfterMs ?? 0, backoff),
        countsAsAttempt: retryAfterMs === undefined,
      };
    case 'transient':
      return { retry: attempt < MAX_ATTEMPTS, delayMs: backoff, countsAsAttempt: true };
    case 'quota':
      return { retry: true, delayMs: QUOTA_PAUSE_MS, countsAsAttempt: false };
    case 'refused':
    case 'bad_request':
      return { retry: false, delayMs: 0, countsAsAttempt: true };
  }
}
