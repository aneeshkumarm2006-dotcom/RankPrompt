import { describe, expect, it } from 'vitest';
import { EDGE_SECRET_HEADER, proxyApiRequest } from './apiProxy';

const ENV = { API_ORIGIN: 'https://pv-api.onrender.com', EDGE_PROXY_SECRET: 's'.repeat(40) };

const forwarded = (res: Response) => {
  const keys = (res.headers.get('x-middleware-override-headers') ?? '').split(',');
  return Object.fromEntries(
    keys.map((k) => [k, res.headers.get(`x-middleware-request-${k}`)] as const),
  );
};

describe('proxyApiRequest', () => {
  it('rewrites to the API origin with path and query, adding the secret', () => {
    const req = new Request('https://app.example.com/api/runs/abc?x=1', {
      headers: { cookie: 'pv_at=1', 'x-forwarded-for': '203.0.113.9', host: 'app.example.com' },
    });
    const res = proxyApiRequest(req, ENV);

    expect(res.headers.get('x-middleware-rewrite')).toBe(
      'https://pv-api.onrender.com/api/runs/abc?x=1',
    );
    const headers = forwarded(res);
    expect(headers[EDGE_SECRET_HEADER]).toBe(ENV.EDGE_PROXY_SECRET);
    expect(headers.cookie).toBe('pv_at=1');
    expect(headers['x-forwarded-for']).toBe('203.0.113.9');
    expect(headers).not.toHaveProperty('host');
  });

  it('overwrites a secret header sent by the client', () => {
    const req = new Request('https://app.example.com/api/me', {
      headers: { [EDGE_SECRET_HEADER]: 'forged' },
    });
    expect(forwarded(proxyApiRequest(req, ENV))[EDGE_SECRET_HEADER]).toBe(ENV.EDGE_PROXY_SECRET);
  });

  it('ignores any path on API_ORIGIN', () => {
    const res = proxyApiRequest(new Request('https://app.example.com/api/ready'), {
      ...ENV,
      API_ORIGIN: 'https://pv-api.onrender.com/api/',
    });
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://pv-api.onrender.com/api/ready');
  });

  it.each([
    { API_ORIGIN: undefined },
    { API_ORIGIN: 'not a url' },
    { API_ORIGIN: 'ftp://pv-api.onrender.com' },
    { EDGE_PROXY_SECRET: ' ' },
  ])('answers 503 instead of proxying when misconfigured (%o)', (patch) => {
    const res = proxyApiRequest(new Request('https://app.example.com/api/me'), {
      ...ENV,
      ...patch,
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
