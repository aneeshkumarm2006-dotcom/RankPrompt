// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { publicReportFixture } from './__fixtures__/publicReport';
import { SharedReportPage } from './SharedReportPage';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn<typeof fetch>();
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const renderAt = (token: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/share/:token" element={<SharedReportPage />} />
    </Routes>,
    { route: `/share/${token}` },
  );

describe('SharedReportPage', () => {
  it('renders the public report read-only and asks robots not to index it', async () => {
    fetchMock.mockResolvedValue(json(200, publicReportFixture()));
    const view = renderAt(TOKEN);
    expect(await screen.findByText('Acme - Visibility Analysis')).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/public/shares/${TOKEN}`);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
    view.unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('shows a friendly page for a revoked or expired link', async () => {
    fetchMock.mockResolvedValue(json(404, { error: { code: 'NOT_FOUND', message: 'gone' } }));
    renderAt(TOKEN);
    expect(await screen.findByText('This link is no longer available')).toBeTruthy();
  });

  it('does not call the API for a malformed token', () => {
    renderAt('short');
    expect(screen.getByText('This link is no longer available')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
