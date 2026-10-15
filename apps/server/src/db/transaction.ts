import mongoose, { type ClientSession } from 'mongoose';

/**
 * Runs `fn` in a MongoDB transaction and commits it, or aborts everything if `fn` throws.
 * Every write inside must pass `{ session }`.
 *
 * The driver retries the whole callback on transient errors, so `fn` may run more than once:
 * it must not have side effects outside the database (no emails, no provider calls).
 */
export function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  return mongoose.connection.transaction(fn, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });
}
