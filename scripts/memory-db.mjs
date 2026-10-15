import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** Fixed port so a separately started `pnpm db:dev` can be pointed at from apps/server/.env. */
export const DEV_DB_PORT = 27027;
export const DEV_DB_NAME = 'promptverse_v2';

/**
 * Starts a single-node in-memory replica set (transactions need one), no Docker required.
 * Data lives only as long as the process. The first run downloads a mongod binary (~100 MB).
 */
export async function startMemoryDb() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0' },
    instanceOpts: [{ port: DEV_DB_PORT }],
  });
  return { replSet, uri: replSet.getUri(DEV_DB_NAME) };
}
