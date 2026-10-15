// @vitest-environment jsdom
import { buildPlansResponse, type Brand, type Me, type Schedule } from '@pv/shared';
import { screen } from '@testing-library/react';
import { Outlet, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { SchedulesPage } from './SchedulesPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const BRAND_ID = 'a'.repeat(24);

const me: Me = {
  user: {
    id: 'u1',
    name: 'Ada',
    email: 'ada@example.com',
    emailVerified: true,
    avatarUrl: null,
    authMethods: ['password'],
    emailPrefs: { runCompleted: true, lowCredits: true },
  },
  workspace: {
    id: 'w1',
    name: 'Ada',
    plan: {
      tier: 'free',
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      pendingTier: null,
    },
    credits: { plan: 0, purchased: 42, total: 42 },
    limits: {
      brands: 1,
      brandsUsed: 1,
      maxPromptsPerRun: 25,
      platforms: ['chatgpt', 'perplexity'],
    },
    referralCode: 'ABCD1234',
  },
};

const brand: Brand = {
  id: BRAND_ID,
  name: 'Acme',
  domain: 'acme.com',
  websiteUrl: 'https://acme.com',
  aliases: [],
  summary: '',
  categories: [],
  competitors: [],
  defaults: {
    country: 'US',
    city: null,
    language: 'en',
    scope: 'national',
    platforms: ['chatgpt'],
  },
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const schedule: Schedule = {
  id: 'b'.repeat(24),
  brandId: BRAND_ID,
  label: 'Monday check',
  frequency: 'weekly',
  hour: 9,
  timezone: 'America/Toronto',
  weekday: 1,
  dayOfMonth: null,
  platforms: ['chatgpt', 'perplexity'],
  promptSelection: { mode: 'fixed', promptIds: ['c'.repeat(24)] },
  country: 'US',
  city: null,
  language: 'en',
  scope: 'national',
  isActive: true,
  pausedReason: null,
  consecutiveSkips: 0,
  nextRunAt: '2026-10-19T13:00:00.000Z',
  lastRunAt: null,
  lastRunId: null,
  lastSkip: { at: '2026-10-12T13:00:00.000Z', reason: 'no_prompts' },
  creditsPerRun: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
let schedules: Schedule[] = [];

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  schedules = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === '/api/me') return Promise.resolve(json(200, me));
    if (url === '/api/plans') return Promise.resolve(json(200, buildPlansResponse()));
    if (url.startsWith(`/api/brands/${BRAND_ID}/prompts`)) return Promise.resolve(json(200, []));
    if (url === `/api/brands/${BRAND_ID}/schedules`) {
      return Promise.resolve(json(200, schedules));
    }
    return Promise.resolve(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const renderPage = (b: Brand = brand) =>
  renderWithProviders(
    <Routes>
      <Route element={<Outlet context={{ brand: b }} />}>
        <Route path="/app/brands/:brandId/schedules" element={<SchedulesPage />} />
      </Route>
    </Routes>,
    { route: `/app/brands/${BRAND_ID}/schedules` },
  );

describe('SchedulesPage', () => {
  it('shows the empty state with the credits banner when there are no schedules', async () => {
    renderPage();
    expect(await screen.findByText('No schedules yet')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('42 credits')).toBeTruthy();
    expect(screen.getByRole('button', { name: /New schedule/ })).toBeTruthy();
  });

  it('lists schedules with their cost and why the last slot was skipped', async () => {
    schedules = [schedule];
    renderPage();
    expect(await screen.findByText('Monday check')).toBeTruthy();
    expect(screen.getByText('Weekly on Monday at 09:00 America/Toronto')).toBeTruthy();
    expect(screen.getByText('2 credits')).toBeTruthy();
    expect(screen.getByText(/None of the selected prompts is active any more/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the prompt library' })).toBeTruthy();
  });

  it('is read-only for an archived brand', async () => {
    renderPage({ ...brand, archivedAt: '2026-02-01T00:00:00.000Z' });
    expect(await screen.findByText(/This brand is archived/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /New schedule/ })).toBeNull();
  });
});
