import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiFetch } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const expired = () => json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } });
const schema = z.object({ ok: z.literal(true) });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const calledUrls = () => fetchMock.mock.calls.map(([input]) => urlOf(input));

describe('apiFetch', () => {
  it('calls same-origin /api with cookies and parses the body with the schema', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await expect(apiFetch('/health', { schema })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/health');
    expect(init?.credentials).toBe('include');
    expect(init?.method).toBe('GET');
  });

  it('sends JSON bodies', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await apiFetch('/things', { method: 'POST', body: { a: 1 }, schema: z.undefined() });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('turns the error envelope into a typed ApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      json(402, { error: { code: 'INSUFFICIENT_CREDITS', message: 'Top up', requestId: 'r1' } }),
    );
    const err = await apiFetch('/runs', { schema }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'INSUFFICIENT_CREDITS', status: 402, requestId: 'r1' });
  });

  it('rejects a success body that breaks the contract', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: 'yes' }));
    await expect(apiFetch('/health', { schema })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiFetch('/health', { schema })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('refreshes once on TOKEN_EXPIRED, shared by concurrent calls, then retries each once', async () => {
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url === '/api/auth/refresh') return Promise.resolve(new Response(null, { status: 204 }));
      const refreshed = calledUrls().includes('/api/auth/refresh');
      return Promise.resolve(refreshed ? json(200, { ok: true }) : expired());
    });

    const results = await Promise.all([apiFetch('/a', { schema }), apiFetch('/b', { schema })]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(calledUrls().filter((u) => u === '/api/auth/refresh')).toHaveLength(1);
    expect(calledUrls().filter((u) => u === '/api/a')).toHaveLength(2);
  });

  it('gives up with TOKEN_EXPIRED when the refresh fails', async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input) === '/api/auth/refresh'
          ? json(401, { error: { code: 'UNAUTHENTICATED', message: 'no session' } })
          : expired(),
      ),
    );
    await expect(apiFetch('/a', { schema })).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(calledUrls()).toEqual(['/api/a', '/api/auth/refresh']);
  });
});
