/** Builds `?a=1&b=x` from defined values only. */
export function toQuery(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** A fresh `Idempotency-Key` for one user action (08: `POST /runs`, run-now). */
export const newIdempotencyKey = (): string => crypto.randomUUID();
