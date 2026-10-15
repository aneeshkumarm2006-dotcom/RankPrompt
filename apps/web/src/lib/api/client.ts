import { errorEnvelopeSchema, type ErrorCode } from '@pv/shared';
import type { z } from 'zod';

/** Same origin, always (D-018): Vite proxies /api in dev, the Vercel rewrite does in production. */
const API_BASE = '/api';

/** Server error codes, plus the two failures only the client can see. */
export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    /** HTTP status; 0 when the request never got a response. */
    readonly status: number,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiFetchOptions<S extends z.ZodType> {
  /** Parses the success body. Use `z.undefined()` for 204 responses. */
  schema: S;
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function send(path: string, opts: ApiFetchOptions<z.ZodType>): Promise<Response> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    // Auth lives in httpOnly cookies (07); nothing token-like is ever read or stored here.
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  if (opts.signal) init.signal = opts.signal;
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.', 0);
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(res: Response, body: unknown): ApiError {
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (parsed.success) {
    const { code, message, details, requestId } = parsed.data.error;
    return new ApiError(code, message, res.status, details, requestId);
  }
  return new ApiError(
    res.status >= 500 ? 'INTERNAL' : 'INVALID_RESPONSE',
    `Unexpected response from the server (${res.status})`,
    res.status,
  );
}

/** One refresh at a time, shared by every request that hit TOKEN_EXPIRED (07 § Sessions). */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(
      (res) => res.ok,
      () => false,
    )
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Typed call to the API. The success body is parsed with `schema` (shared zod contract); an error
 * body becomes an `ApiError`. On `TOKEN_EXPIRED` it refreshes the session once and retries once.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  opts: ApiFetchOptions<S>,
): Promise<z.output<S>> {
  let res = await send(path, opts);
  let body = await readJson(res);

  if (!res.ok) {
    const error = toApiError(res, body);
    if (error.code !== 'TOKEN_EXPIRED' || !(await refreshSession())) throw error;
    res = await send(path, opts);
    body = await readJson(res);
    if (!res.ok) throw toApiError(res, body);
  }

  const parsed = opts.schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      'INVALID_RESPONSE',
      'The server sent an unexpected response',
      res.status,
      parsed.error.issues,
    );
  }
  return parsed.data;
}
