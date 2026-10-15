// API for the Playwright suite: a throwaway in-memory replica set (random port) and the server
// with FAKE_PROVIDERS=true, so no real provider is ever called and nothing costs money. It runs
// apps/server/scripts/e2e-server.ts: the real app plus a fake Stripe and captured emails (8.5).
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: 'rs0' } });
const uri = replSet.getUri('promptverse_e2e');
console.log(`[e2e] database ready: ${uri}`);

// One command string through the shell: pnpm is a .cmd shim on Windows.
const server = spawn('pnpm --filter @pv/server exec tsx scripts/e2e-server.ts', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    MONGODB_URI: uri,
    PORT: process.env.E2E_API_PORT ?? '4100',
    APP_URL: process.env.E2E_APP_URL ?? 'http://localhost:5180',
    FAKE_PROVIDERS: 'true',
    RUN_WORKER: 'true',
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? 'warn',
    // Never pick up a local Google or Stripe setup from apps/server/.env.
    GOOGLE_CLIENT_ID: '',
  },
});

const stop = async (code = 0) => {
  server.kill();
  await replSet.stop();
  process.exit(code);
};
server.on('exit', (code) => void stop(code ?? 0));
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
