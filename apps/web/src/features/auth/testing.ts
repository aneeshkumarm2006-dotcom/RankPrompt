import type { Me, PlansResponse } from '@pv/shared';
import { vi } from 'vitest';

/** Test-only helpers for the auth and landing component tests. */

export const meFixture: Me = {
  user: {
    id: 'u1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    emailVerified: false,
    avatarUrl: null,
    authMethods: ['password'],
    emailPrefs: { runCompleted: true, lowCredits: true },
  },
  workspace: {
    id: 'w1',
    name: 'Jane',
    plan: {
      tier: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      pendingTier: null,
    },
    credits: { plan: 0, purchased: 42, total: 42 },
    limits: { brands: 1, brandsUsed: 0, maxPromptsPerRun: 25, platforms: ['chatgpt'] },
    referralCode: 'ABCD1234',
  },
};

/** Deliberately unlike the real plan matrix, so tests prove the UI reads `GET /plans`. */
export const plansFixture: PlansResponse = {
  plans: [
    {
      tier: 'free',
      name: 'Free',
      priceCentsMonthly: 0,
      monthlyCredits: 0,
      limits: { brands: 1, maxPromptsPerRun: 10, platforms: ['chatgpt'], scheduleFrequencies: [] },
    },
    {
      tier: 'starter',
      name: 'Starter',
      priceCentsMonthly: 12300,
      monthlyCredits: 777,
      limits: {
        brands: 4,
        maxPromptsPerRun: 60,
        platforms: ['chatgpt', 'perplexity'],
        scheduleFrequencies: ['weekly'],
      },
    },
    {
      tier: 'pro',
      name: 'Pro',
      priceCentsMonthly: 45600,
      monthlyCredits: 2000,
      limits: {
        brands: 1,
        maxPromptsPerRun: 150,
        platforms: ['chatgpt', 'perplexity', 'gemini', 'claude', 'google_aio'],
        scheduleFrequencies: ['daily', 'weekly'],
      },
    },
  ],
  topups: [],
  grants: { signupBonus: 42, referral: 7, survey: 50 },
};

export const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const apiError = (status: number, code: string, message: string): Response =>
  jsonResponse(status, { error: { code, message } });

type Handler = (init: RequestInit | undefined) => Response;

/**
 * Stubs `fetch` with `"METHOD /path"` handlers (path without `/api`). `GET /me` defaults to
 * signed out and `GET /plans` to `plansFixture`. Returns the mock to inspect calls.
 */
export function mockApi(handlers: Record<string, Handler> = {}) {
  const all: Record<string, Handler> = {
    'GET /me': () => apiError(401, 'UNAUTHENTICATED', 'Sign in'),
    'GET /plans': () => jsonResponse(200, plansFixture),
    ...handlers,
  };
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const key = `${init?.method ?? 'GET'} ${url.replace(/^\/api/, '')}`;
    const handler = all[key];
    return Promise.resolve(handler ? handler(init) : apiError(404, 'NOT_FOUND', `No mock: ${key}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The parsed JSON body of the first call to `"METHOD /path"`. */
export function sentBody(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => input === `/api${path}` && (init?.method ?? 'GET') === method,
  );
  const body = call?.[1]?.body;
  return typeof body === 'string' ? (JSON.parse(body) as unknown) : undefined;
}
