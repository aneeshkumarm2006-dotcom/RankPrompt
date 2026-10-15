// `pnpm db:dev`: run only the in-memory MongoDB replica set, until Ctrl+C.
import { startMemoryDb } from './memory-db.mjs';

const { replSet, uri } = await startMemoryDb();
console.log(`[db] in-memory replica set ready: ${uri}`);
console.log('[db] data is lost when this process stops. Ctrl+C to stop.');

const stop = async () => {
  await replSet.stop();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
