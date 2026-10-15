import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { finalizeCitations } from '@pv/engine';
import { noopReporter } from '../src/config/sentry';
import { errorHandler } from '../src/http/middleware/errorHandler';
import { EDGE_SECRET_HEADER, edgeProxyGuard } from '../src/http/middleware/edgeProxy';
import { ErrorSpikeAlarm } from '../src/http/middleware/errorSpike';
import { DEFAULT_RATE_LIMITS, authIpLimiter, hopIp } from '../src/http/middleware/rateLimits';
import { maskUrl } from '../src/http/middleware/requestLogger';
import { silentLogger } from './helpers';

/** Small fixes from the 8.3 security review. */

describe('per-IP auth limit behind a forgeable X-Forwarded-For', () => {
  function app() {
    const a = express();
    a.set('trust proxy', 2); // production: Vercel rewrite → Render proxy → us
    a.post(
      '/login',
      authIpLimiter({ ...DEFAULT_RATE_LIMITS, authPerIp: { limit: 2, windowMs: 60_000 } }),
      (_req, res) => void res.status(204).end(),
    );
    a.use(errorHandler(noopReporter));
    return a;
  }

  it('the hop Render saw is the last X-Forwarded-For entry', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' }, socket: {} };
    expect(hopIp(req as never)).toBe('9.9.9.9');
    expect(hopIp({ headers: {}, socket: { remoteAddress: '::1' } } as never)).toBe('::1');
  });

  it('rotating a forged client IP still hits the per-hop backstop (10× the limit)', async () => {
    const a = app();
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await request(a).post('/login').set('X-Forwarded-For', `10.0.${i}.1, 9.9.9.9`); // straight to Render, forged first entry
      codes.push(res.status);
    }
    expect(codes.slice(0, 20).every((c) => c === 204)).toBe(true);
    expect(codes[20]).toBe(429);
  });

  it('one real client is still limited by its own IP', async () => {
    const a = app();
    const send = () => request(a).post('/login').set('X-Forwarded-For', '5.5.5.5, 8.8.8.8');
    await send().expect(204);
    await send().expect(204);
    await send().expect(429);
  });
});

describe('edge proxy secret (D-027 follow-up, go-live 9.1)', () => {
  const SECRET = 'e'.repeat(48);

  function app(secret: string | undefined) {
    const a = express();
    a.set('trust proxy', 2); // production: Vercel rewrite → Render proxy → us
    a.use(edgeProxyGuard(secret));
    a.get('/ip', (req, res) => {
      res.json({ ip: req.ip, leaked: req.headers[EDGE_SECRET_HEADER] ?? null });
    });
    return a;
  }

  it('trusts X-Forwarded-For when the Vercel middleware sent the secret', async () => {
    const res = await request(app(SECRET))
      .get('/ip')
      .set('X-Forwarded-For', '5.5.5.5, 8.8.8.8')
      .set(EDGE_SECRET_HEADER, SECRET);
    expect(res.body).toEqual({ ip: '5.5.5.5', leaked: null });
  });

  it.each([
    ['no secret', undefined],
    ['a wrong secret', 'x'.repeat(48)],
    ['a short wrong secret', 'x'],
  ])('keys a direct request with %s on the hop Render saw', async (_label, sent) => {
    const req = request(app(SECRET)).get('/ip').set('X-Forwarded-For', '10.0.0.1, 9.9.9.9');
    const res = await (sent ? req.set(EDGE_SECRET_HEADER, sent) : req);
    expect(res.body).toEqual({ ip: '9.9.9.9', leaked: null });
  });

  it('without a secret configured, behaves as before', async () => {
    const res = await request(app(undefined)).get('/ip').set('X-Forwarded-For', '5.5.5.5, 8.8.8.8');
    expect(res.body).toEqual({ ip: '5.5.5.5', leaked: null });
  });
});

describe('secrets in logs', () => {
  it('masks share tokens and token= query values', () => {
    expect(maskUrl('/api/public/shares/AbC123_-xyz')).toBe('/api/public/shares/***');
    expect(maskUrl('/api/public/shares/AbC123?x=1')).toBe('/api/public/shares/***?x=1');
    expect(maskUrl('/verify-email?token=abc&x=1')).toBe('/verify-email?token=***&x=1');
    expect(maskUrl('/api/runs/123')).toBe('/api/runs/123');
  });
});

describe('5xx spike alert', () => {
  it('fires once per window when the threshold is reached', () => {
    let now = 0;
    const captured: string[] = [];
    const alarm = new ErrorSpikeAlarm({
      logger: silentLogger,
      reporter: { ...noopReporter, capture: (e) => captured.push((e as Error).message) },
      threshold: 3,
      windowMs: 1_000,
      now: () => now,
    });
    alarm.record();
    alarm.record();
    expect(captured).toEqual([]);
    alarm.record(); // 3 within 1 s
    alarm.record();
    expect(captured).toEqual(['5xx spike']);
    now = 5_000; // a new window, but only one error in it
    alarm.record();
    expect(captured).toHaveLength(1);
  });
});

describe('citations', () => {
  it('keeps only http(s) links', () => {
    const out = finalizeCitations([
      { url: 'javascript:alert(1)' },
      { url: 'data:text/html,hi' },
      { url: 'https://ok.example/a' },
      { url: 'HTTP://old.example/' },
    ]);
    expect(out.map((c) => c.domain)).toEqual(['ok.example', 'old.example']);
  });
});
