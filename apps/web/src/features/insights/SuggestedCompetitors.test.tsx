// @vitest-environment jsdom
import type { Brand } from '@pv/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { SuggestedCompetitors } from './SuggestedCompetitors';

const brand: Brand = {
  id: 'b1',
  name: 'Davnoot',
  domain: 'davnoot.com',
  websiteUrl: 'https://davnoot.com',
  aliases: [],
  summary: '',
  categories: [],
  competitors: [{ id: 'c1', name: 'Acme', domain: 'acme.com', aliases: ['ACME'] }],
  defaults: {
    country: 'US',
    city: null,
    language: 'en',
    scope: 'national',
    platforms: ['chatgpt'],
  },
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SuggestedCompetitors', () => {
  it('tracks a suggestion with the full list, keeping existing ids', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...brand,
          competitors: [
            ...brand.competitors,
            { id: 'c2', name: 'Initech', domain: 'initech.com', aliases: [] },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    renderWithProviders(
      <SuggestedCompetitors
        brand={brand}
        suggestions={[{ name: 'Initech', mentions: 4, bestRank: 1, avgRank: 2.5 }]}
      />,
    );

    expect(screen.getByText(/best #1 · avg #2.5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Track' }));

    // The domain is required.
    fireEvent.click(screen.getByRole('button', { name: 'Track competitor' }));
    expect(await screen.findByText(/Enter the competitor/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Website domain'), { target: { value: 'initech.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Track competitor' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/brands/b1/competitors');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({
      competitors: [
        { id: 'c1', name: 'Acme', domain: 'acme.com', aliases: ['ACME'] },
        { name: 'Initech', domain: 'initech.com', aliases: [] },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
