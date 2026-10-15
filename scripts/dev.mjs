// `pnpm dev`: database + API server + web app, together.
// - If apps/server/.env (or the shell) sets MONGODB_URI, that database is used.
// - Otherwise an in-memory replica set is started here and handed to the server.
import { existsSync } from 'node:fs';
import concurrently from 'concurrently';
import { startMemoryDb } from './memory-db.mjs';

const serverEnvFile = new URL('../apps/server/.env', import.meta.url);
if (existsSync(serverEnvFile)) process.loadEnvFile(serverEnvFile);

let replSet;
let mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  console.log('[dev] using MONGODB_URI from the environment / apps/server/.env');
} else {
  console.log('[dev] starting the in-memory MongoDB replica set…');
  ({ replSet, uri: mongoUri } = await startMemoryDb());
  console.log(`[dev] database ready: ${mongoUri}`);
}

const { result } = concurrently(
  [
    {
      name: 'server',
      command: 'pnpm --filter @pv/server dev',
      prefixColor: 'blue',
      env: { NODE_ENV: 'development', MONGODB_URI: mongoUri },
    },
    { name: 'web', command: 'pnpm --filter @pv/web dev', prefixColor: 'magenta' },
  ],
  { killOthersOn: ['failure', 'success'], handleInput: false },
);

const stopDb = async () => {
  await replSet?.stop();
};
result.then(stopDb, stopDb).finally(() => process.exit(0));
