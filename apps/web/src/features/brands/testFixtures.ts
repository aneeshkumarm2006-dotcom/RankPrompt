import type { Brand, BrandListItem, Me, Prompt } from '@pv/shared';
import { vi } from 'vitest';

/** Test data for the brands feature (tests only). */

export function makeMe(limits: Partial<Me['workspace']['limits']> = {}): Me {
  return {
    user: {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      avatarUrl: null,
      authMethods: ['password'],
      emailPrefs: { runCompleted: true, lowCredits: true },
    },
    workspace: {
      id: 'w1',
      name: 'Test',
      plan: {
        tier: 'starter',
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pendingTier: null,
      },
      credits: { plan: 100, purchased: 0, total: 100 },
      limits: {
        brands: 3,
        brandsUsed: 1,
        maxPromptsPerRun: 25,
        platforms: ['chatgpt', 'perplexity'],
        ...limits,
      },
      referralCode: 'REF',
    },
  };
}

export function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'b1',
    name: 'Acme',
    domain: 'acme.com',
    websiteUrl: 'https://acme.com',
    aliases: ['Acme Inc'],
    summary: 'Acme sells anvils.',
    categories: [
      { name: 'Anvils', description: 'Heavy things', source: 'generated' },
      { name: 'Rockets', description: '', source: 'custom' },
    ],
    competitors: [],
    defaults: {
      country: 'US',
      city: null,
      language: 'en',
      scope: 'national',
      platforms: ['chatgpt', 'perplexity'],
    },
    archivedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

export function makeListItem(overrides: Partial<BrandListItem> = {}): BrandListItem {
  return {
    ...makeBrand(),
    promptCount: 10,
    activeSchedules: 1,
    latestRun: {
      id: 'r1',
      status: 'completed',
      createdAt: '2026-10-02T10:00:00.000Z',
      visibility: { num: 11, den: 26, rate: 0.4231 },
    },
    ...overrides,
  };
}

export function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'p1',
    brandId: 'b1',
    text: 'Best anvil supplier?',
    category: 'Anvils',
    source: 'generated',
    replacesId: null,
    archivedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Stubs `fetch` with GET routes keyed by path (query string ignored); others 404. */
export function stubApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn<typeof fetch>((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(/^\/api/, '').split('?')[0] ?? '';
    if (path in routes) return Promise.resolve(json(routes[path]));
    return Promise.resolve(json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
