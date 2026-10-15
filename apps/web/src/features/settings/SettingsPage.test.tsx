// @vitest-environment jsdom
import type { Me } from '@pv/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { SettingsPage } from './SettingsPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const me = (authMethods: Me['user']['authMethods']): Me => ({
  user: {
    id: 'u1',
    name: 'Ada',
    email: 'ada@example.com',
    emailVerified: false,
    avatarUrl: null,
    authMethods,
    emailPrefs: { runCompleted: true, lowCredits: false },
  },
  workspace: {
    id: 'w1',
    name: 'Ada',
    plan: {
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      pendingTier: null,
    },
    credits: { plan: 100, purchased: 5, total: 105 },
    limits: { brands: 3, brandsUsed: 1, maxPromptsPerRun: 150, platforms: ['chatgpt'] },
    referralCode: 'ABCD1234',
  },
});

const fetchMock = vi.fn<typeof fetch>();
const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const serve = (account: Me) =>
  fetchMock.mockImplementation((input) => {
    const url = urlOf(input);
    if (url === '/api/me') return Promise.resolve(json(200, account));
    if (url === '/api/me/password') {
      return Promise.resolve(json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'no' } }));
    }
    return Promise.resolve(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsPage', () => {
  it('shows the real plan and an unverified email with a resend button', async () => {
    serve(me(['password']));
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Pro')).toBeTruthy();
    expect(screen.getByText('105 (100 plan + 5 purchased)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resend verification' })).toBeTruthy();
  });

  it('shows the email opt-outs and saves a change with PATCH /me', async () => {
    serve(me(['password']));
    renderWithProviders(<SettingsPage />);
    const summaries = await screen.findByLabelText(/Scheduled report summaries/);
    const low = screen.getByLabelText(/Low-credit warnings/);
    expect((summaries as HTMLInputElement).checked).toBe(true);
    expect((low as HTMLInputElement).checked).toBe(false);

    fireEvent.click(summaries);
    await vi.waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch).toBeTruthy();
      expect(JSON.parse(patch?.[1]?.body as string)).toEqual({
        emailPrefs: { runCompleted: false },
      });
    });
  });

  it('says a Google-only account has no password to change', async () => {
    serve(me(['google']));
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText(/You sign in with Google/)).toBeTruthy();
    expect(screen.queryByLabelText('Current password')).toBeNull();
  });

  it('checks the confirmation and maps INVALID_CREDENTIALS to the current password', async () => {
    serve(me(['password']));
    renderWithProviders(<SettingsPage />);
    const current = await screen.findByLabelText('Current password');
    fireEvent.change(current, { target: { value: 'old-secret' } });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a-much-better-one' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Passwords do not match')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-much-better-one' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Your current password is incorrect')).toBeTruthy();
  });
});
