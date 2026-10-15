import { ProviderError, kindForStatus, networkError, parseRetryAfter } from './errors';
import type { ProviderKey } from './types';

export type FetchLike = typeof fetch;

/** Each adapter call has a hard 120 s timeout on top of the caller's signal (03 § Timeouts). */
export const ASK_TIMEOUT_MS = 120_000;

export const withTimeout = (signal: AbortSignal, ms: number): AbortSignal =>
  AbortSignal.any([signal, AbortSignal.timeout(ms)]);

const errorText = (body: unknown): string => {
  if (body && typeof body === 'object') {
    const b = body as {
      error?: { message?: unknown } | string;
      message?: unknown;
      detail?: unknown;
    };
    if (typeof b.error === 'string') return b.error;
    if (b.error && typeof b.error.message === 'string') return b.error.message;
    if (typeof b.message === 'string') return b.message;
    if (typeof b.detail === 'string') return b.detail;
  }
  return typeof body === 'string' ? body.slice(0, 500) : '';
};

/** POST JSON and return the parsed body. Non-2xx and network failures throw `ProviderError`. */
export async function postJson<T>(
  provider: ProviderKey,
  url: string,
  body: unknown,
  opts: { fetch?: FetchLike | undefined; headers?: Record<string, string>; signal: AbortSignal },
): Promise<T> {
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    throw networkError(provider, e);
  }
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    throw networkError(provider, e);
  }
  let parsed: unknown = text;
  try {
    parsed = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    if (res.ok) {
      throw new ProviderError(provider, 'transient', 'response was not JSON', {
        status: res.status,
      });
    }
  }
  if (!res.ok) {
    const message = errorText(parsed) || res.statusText || `HTTP ${res.status}`;
    throw new ProviderError(provider, kindForStatus(res.status, message), message, {
      status: res.status,
      retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
    });
  }
  return parsed as T;
}
