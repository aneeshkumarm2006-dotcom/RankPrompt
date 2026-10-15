/** A unique-index violation (E11000), optionally on a specific indexed field. */
export function isDuplicateKeyError(err: unknown, field?: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; keyPattern?: Record<string, unknown> };
  if (e.code !== 11000) return false;
  return field === undefined || (e.keyPattern !== undefined && field in e.keyPattern);
}
