import type { HealthResponse, ReadyResponse } from '@pv/shared';
import { Router } from 'express';
import type { Env } from '../../config/env';
import type { Readiness } from '../../lifecycle/readiness';
import { VERSION } from '../../version';

const DB_PING_TIMEOUT_MS = 2_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

export function healthRoutes(deps: { env: Pick<Env, 'RUN_WORKER'>; readiness: Readiness }): Router {
  const router = Router();

  /** Liveness: the process is up. Never touches the DB. */
  router.get('/health', (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json({ ok: true, version: VERSION } satisfies HealthResponse);
  });

  /** Readiness (Render health check): DB reachable and not shutting down. 503 otherwise. */
  router.get('/ready', async (_req, res) => {
    let db: ReadyResponse['checks']['db'] = { ok: false, latencyMs: null };
    try {
      db = { ok: true, latencyMs: await withTimeout(deps.readiness.pingDb(), DB_PING_TIMEOUT_MS) };
    } catch {
      // reported as db.ok = false
    }
    const shuttingDown = deps.readiness.isShuttingDown();
    const body: ReadyResponse = {
      ok: db.ok && !shuttingDown,
      version: VERSION,
      checks: {
        db,
        worker: {
          enabled: deps.env.RUN_WORKER,
          heartbeatAgeMs: deps.readiness.workerHeartbeatAgeMs(),
        },
        shuttingDown,
      },
    };
    res
      .status(body.ok ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json(body);
  });

  return router;
}
