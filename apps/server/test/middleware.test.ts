import { errorEnvelopeSchema } from '@pv/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LoginThrottle } from '../src/http/middleware/rateLimits';
import { AppError } from '../src/http/errors';
import {
  APP_URL,
  PASSWORD,
  client,
  connectTestDb,
  dropTestDb,
  makeTestApp,
  signUp,
  uniqueEmail,
} from './helpers';

beforeAll(() => connectTestDb('middleware_test'));
afterAll(() => dropTestDb());

const codeOf = (body: unknown) => errorEnvelopeSchema.parse(body).error.code;

describe('Origin check (CSRF, 07)', () => {
  const { app } = makeTestApp();
  const body = { email: uniqueEmail(), password: PASSWORD };

  it('rejects state-changing requests without our Origin', async () => {
    const missing = await request(app).post('/api/auth/login').send(body).expect(403);
    expect(codeOf(missing.body)).toBe('FORBIDDEN');
    const evil = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send(body)
      .expect(403);
    expect(codeOf(evil.body)).toBe('FORBIDDEN');
  });

  it('rejects non-JSON bodies, so cross-site form posts never parse', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', APP_URL)
      .type('form')
      .send('email=a@b.co&password=x')
      .expect(415);
    expect(codeOf(res.body)).toBe('VALIDATION_FAILED');
  });

  it('lets GETs through without an Origin', async () => {
    await request(app).get('/api/plans').expect(200);
  });
});

describe('rate limits', () => {
  it('limits every /api request per IP, with the error envelope', async () => {
    const { app } = makeTestApp({ limits: { global: { limit: 3, windowMs: 60_000 } } });
    for (let i = 0; i < 3; i++) await request(app).get('/api/plans').expect(200);
    const res = await request(app).get('/api/plans').expect(429);
    expect(codeOf(res.body)).toBe('RATE_LIMITED');
  });

  it('limits register and login per IP', async () => {
    const { app } = makeTestApp({ limits: { authPerIp: { limit: 2, windowMs: 60_000 } } });
    const login = () =>
      client(app).post('/api/auth/login').send({ email: uniqueEmail(), password: PASSWORD });
    expect((await login()).status).toBe(401);
    expect((await login()).status).toBe(401);
    expect((await login()).status).toBe(429);
  });

  it('locks an email out after repeated failed logins, even with the right password', async () => {
    const { app } = makeTestApp({
      limits: { loginPerEmail: { limit: 3, windowMs: 60_000, maxLockMs: 600_000 } },
    });
    const { email } = await signUp(app);
    for (let i = 0; i < 3; i++) {
      await client(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong guess!' })
        .expect(401);
    }
    const locked = await client(app)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(429);
    expect(codeOf(locked.body)).toBe('RATE_LIMITED');
    // Other emails are unaffected.
    const other = await signUp(app);
    await client(app)
      .post('/api/auth/login')
      .send({ email: other.email, password: PASSWORD })
      .expect(200);
  });

  it('limits password-reset emails per address', async () => {
    const { app } = makeTestApp({ limits: { emailSendsPerKey: { limit: 2, windowMs: 60_000 } } });
    const email = uniqueEmail();
    const forgot = (to: string) =>
      client(app).post('/api/auth/forgot-password').send({ email: to });
    expect((await forgot(email)).status).toBe(204);
    expect((await forgot(email.toUpperCase())).status).toBe(204);
    expect((await forgot(email)).status).toBe(429);
    expect((await forgot(uniqueEmail())).status).toBe(204);
  });

  it('limits the costly endpoints per workspace', async () => {
    const { app } = makeTestApp({
      limits: { costlyPerWorkspace: { limit: 1, windowMs: 60_000 } },
    });
    const { agent } = await signUp(app);
    const analyze = () =>
      agent.post('/api/brands/analyze').send({ name: 'Acme', websiteUrl: 'acme.com' });
    expect((await analyze()).status).toBe(200);
    expect((await analyze()).status).toBe(429);
    // A different workspace has its own budget.
    const other = await signUp(app);
    const res = await other.agent
      .post('/api/brands/analyze')
      .send({ name: 'Acme', websiteUrl: 'acme.com' });
    expect(res.status).toBe(200);
  });
});

describe('LoginThrottle', () => {
  it('locks after N failures, doubles each further lockout, caps it, and resets on success', () => {
    let now = 0;
    const throttle = new LoginThrottle({ limit: 2, windowMs: 1_000, maxLockMs: 3_000 }, () => now);
    const fail = (n: number) => {
      for (let i = 0; i < n; i++) throttle.recordFailure('a@b.co');
    };
    const lockedFor = () => {
      try {
        throttle.assertAllowed('a@b.co');
        return 0;
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        return ((err as AppError).details as { retryAfterSeconds: number }).retryAfterSeconds;
      }
    };

    fail(1);
    expect(lockedFor()).toBe(0);
    fail(1);
    expect(lockedFor()).toBe(1); // 1 s
    now += 1_001;
    fail(2);
    expect(lockedFor()).toBe(2); // doubled
    now += 2_001;
    fail(2);
    expect(lockedFor()).toBe(3); // capped at maxLockMs
    throttle.recordSuccess('a@b.co');
    expect(lockedFor()).toBe(0);
  });

  it('forgets failures older than the window', () => {
    let now = 0;
    const throttle = new LoginThrottle({ limit: 2, windowMs: 1_000, maxLockMs: 3_000 }, () => now);
    throttle.recordFailure('x@y.co');
    now += 1_500;
    throttle.recordFailure('x@y.co');
    expect(() => throttle.assertAllowed('x@y.co')).not.toThrow();
  });
});
