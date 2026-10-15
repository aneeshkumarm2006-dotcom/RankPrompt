import type { ProviderKey } from './types';

/** The queue's retry policy is keyed by `kind` (04 § Retry policy). */
export const PROVIDER_ERROR_KINDS = [
  'rate_limited',
  'transient',
  'refused',
  'bad_request',
  'quota',
] as const;
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number];

export class ProviderError extends Error {
  override name = 'ProviderError';
  readonly kind: ProviderErrorKind;
  readonly provider: ProviderKey;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    provider: ProviderKey,
    kind: ProviderErrorKind,
    message: string,
    opts: { status?: number | undefined; retryAfterMs?: number | undefined; cause?: unknown } = {},
  ) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.provider = provider;
    this.kind = kind;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

/** Vendor extraction failed after its own retries. Terminal: the check fails and is refunded. */
export class ExtractError extends Error {
  override name = 'ExtractError';
  readonly code = 'extract_failed';
}

const QUOTA_HINT = /quota|insufficient|billing|credit balance|payment|exceeded your current/i;

/** Maps an HTTP status (plus the error text) to a kind, per 03 § Errors. */
export function kindForStatus(status: number, message = ''): ProviderErrorKind {
  if (status === 402) return 'quota';
  if (status === 429) return QUOTA_HINT.test(message) ? 'quota' : 'rate_limited';
  if (status === 408 || status === 409 || status >= 500) return 'transient';
  if (status === 400 && QUOTA_HINT.test(message)) return 'quota';
  return 'bad_request';
}

/** `Retry-After` is either delta-seconds or an HTTP date. */
export function parseRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

export const isAbortError = (e: unknown): boolean =>
  e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');

/** Network failures, timeouts and aborts are all `transient`; the queue decides what to do. */
export function networkError(provider: ProviderKey, e: unknown): ProviderError {
  const message = isAbortError(e)
    ? 'request timed out or was aborted'
    : `network error: ${e instanceof Error ? e.message : String(e)}`;
  return new ProviderError(provider, 'transient', message, { cause: e });
}
