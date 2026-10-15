import toast from 'react-hot-toast';
import { ApiError } from './api/client';

/** Text to show for a failed call: the server's message (safe by contract, 07) or a fallback. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}

/** An endpoint that isn't built yet (Stage 6/7 APIs) or a resource that's gone. */
export const isNotFound = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'NOT_FOUND';

export const hasCode = (error: unknown, code: ApiError['code']): boolean =>
  error instanceof ApiError && error.code === code;

/** Toasts a failed mutation; use as `onError: toastError`. */
export const toastError = (error: unknown): void => {
  toast.error(errorMessage(error));
};

/** Field errors from a VALIDATION_FAILED response, keyed by dotted path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') return {};
  const out: Record<string, string> = {};
  if (!Array.isArray(error.details)) return out;
  for (const issue of error.details as { path?: unknown; message?: unknown }[]) {
    const key = typeof issue.path === 'string' ? issue.path : '';
    if (typeof issue.message === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}
