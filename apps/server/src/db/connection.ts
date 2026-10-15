import mongoose from 'mongoose';
import type { Logger } from '../config/logger';

/**
 * Global Mongoose settings (07 § Input handling):
 * - `sanitizeFilter`: query filters built from user input can't smuggle operators like `{ $ne: null }`.
 *   Code that needs a real operator on a user-supplied value wraps it in `mongoose.trusted()`.
 * - `strictQuery`: filter paths that aren't in the schema are dropped.
 */
export function applyMongooseDefaults(): void {
  mongoose.set('sanitizeFilter', true);
  mongoose.set('strictQuery', true);
}

export async function connectDb(
  uri: string,
  opts: { logger: Logger; autoIndex: boolean; dbName?: string },
): Promise<typeof mongoose> {
  applyMongooseDefaults();
  const conn = mongoose.connection;
  conn.on('disconnected', () => opts.logger.warn('mongodb disconnected'));
  conn.on('reconnected', () => opts.logger.info('mongodb reconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    // Production indexes are synced once by a script at go-live (ops/deployment.md).
    autoIndex: opts.autoIndex,
    ...(opts.dbName ? { dbName: opts.dbName } : {}),
  });
  opts.logger.info({ db: conn.name }, 'mongodb connected');
  return mongoose;
}

/** Round-trip time of a `ping` in ms. Rejects when the connection is down. */
export async function pingDb(): Promise<number> {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    throw new Error('mongodb is not connected');
  }
  const start = performance.now();
  await db.command({ ping: 1 });
  return Math.round(performance.now() - start);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
