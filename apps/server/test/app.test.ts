import { errorEnvelopeSchema, healthResponseSchema, readyResponseSchema } from '@pv/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inject } from 'vitest';
import { z } from 'zod';
import type { ErrorReporter } from '../src/config/sentry';
import { noopReporter } from '../src/config/sentry';
import { connectDb, disconnectDb, pingDb } from '../src/db/connection';
import { createApp } from '../src/http/app';
import { AppError } from '../src/http/errors';
import { errorHandler, notFoundHandler } from '../src/http/middleware/errorHandler';
import { requestLogger } from '../src/http/middleware/requestLogger';
import type { Readiness } from '../src/lifecycle/readiness';
import { silentLogger, testEnv } from './helpers';

const env = testEnv({ APP_URL: 'http://localhost:5173' });

const makeApp = (readiness: Partial<Readiness> = {}) =>
  createApp({
    env,
    logger: silentLogger,
    reporter: noopReporter,
    readiness: {
      pingDb,
      workerHeartbeatAgeMs: () => null,
      isShuttingDown: () => false,
      ...readiness,
    },
  });

beforeAll(async () => {
  await connectDb(inject('mongoUri'), {
    logger: silentLogger,
    autoIndex: true,
    dbName: 'app_test',
  });
});
afterAll(async () => {
  await disconnectDb();
});

describe('GET /api/health', () => {
  it('reports liveness and the version', async () => {
    const res = await request(makeApp()).get('/api/health').expect(200);
    expect(healthResponseSchema.parse(res.body).ok).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('gives every response a request id, keeping a sane incoming one', async () => {
    const generated = await request(makeApp()).get('/api/health');
    expect(generated.headers['x-request-id']).toMatch(/^[\w-]{8,}$/);
    const echoed = await request(makeApp()).get('/api/health').set('X-Request-Id', 'abc-12345678');
    expect(echoed.headers['x-request-id']).toBe('abc-12345678');
  });
});

describe('GET /api/ready', () => {
  it('is ready when the DB answers', async () => {
    const res = await request(makeApp()).get('/api/ready').expect(200);
    const body = readyResponseSchema.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.worker).toEqual({ enabled: true, heartbeatAgeMs: null });
  });

  it('returns 503 when the DB is unreachable', async () => {
    const app = makeApp({ pingDb: () => Promise.reject(new Error('down')) });
    const res = await request(app).get('/api/ready').expect(503);
    expect(readyResponseSchema.parse(res.body).checks.db).toEqual({ ok: false, latencyMs: null });
  });

  it('returns 503 while shutting down', async () => {
    const res = await request(makeApp({ isShuttingDown: () => true }))
      .get('/api/ready')
      .expect(503);
    expect(readyResponseSchema.parse(res.body).checks.shuttingDown).toBe(true);
  });
});

describe('error envelope', () => {
  it('404s unknown routes inside and outside /api', async () => {
    for (const path of ['/api/nope', '/nope']) {
      const res = await request(makeApp()).get(path).expect(404);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
    }
  });

  it('rejects malformed JSON with VALIDATION_FAILED', async () => {
    const res = await request(makeApp())
      .post('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });

  describe('errorHandler', () => {
    const capture = vi.fn();
    const reporter: ErrorReporter = { ...noopReporter, capture };
    const app = express();
    app.use(requestLogger(silentLogger));
    app.get('/app-error', () => {
      throw new AppError('BRAND_LIMIT_REACHED', 'Upgrade to add more brands', { limit: 1 });
    });
    app.get('/zod', () => {
      z.object({ name: z.string() }).parse({});
    });
    app.get('/boom', async () => {
      await Promise.resolve();
      throw new Error('provider said: secret internals');
    });
    app.use(notFoundHandler);
    app.use(errorHandler(reporter));

    it('maps an AppError to its status, code, message and details', async () => {
      const res = await request(app).get('/app-error').expect(409);
      expect(res.body).toMatchObject({
        error: {
          code: 'BRAND_LIMIT_REACHED',
          message: 'Upgrade to add more brands',
          details: { limit: 1 },
        },
      });
    });

    it('maps a ZodError to VALIDATION_FAILED with issue paths', async () => {
      const res = await request(app).get('/zod').expect(400);
      const { error } = errorEnvelopeSchema.parse(res.body);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details).toEqual([expect.objectContaining({ path: 'name' })]);
    });

    it('hides internals on 5xx, includes the request id, and reports the error', async () => {
      const res = await request(app).get('/boom').expect(500);
      const { error } = errorEnvelopeSchema.parse(res.body);
      expect(error.code).toBe('INTERNAL');
      expect(error.message).not.toContain('secret');
      expect(error.requestId).toBe(res.headers['x-request-id']);
      expect(capture).toHaveBeenCalledOnce();
    });
  });
});

describe('CORS', () => {
  it('allows only APP_URL, with credentials', async () => {
    const ok = await request(makeApp()).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');

    const evil = await request(makeApp()).get('/api/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});
