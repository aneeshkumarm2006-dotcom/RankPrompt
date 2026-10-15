// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { TrendCard } from './TrendCard';

const ratio = (num: number, den: number) => ({ num, den, rate: num / den });
const point = (runId: string, comparableWithPrevious: boolean) => ({
  runId,
  date: '2026-10-01T12:00:00.000Z',
  trigger: 'manual',
  visibility: ratio(1, 4),
  byPlatform: { chatgpt: ratio(1, 2) },
  promptSetHash: 'a',
  platformsHash: 'b',
  comparableWithPrevious,
});

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ points: [point('r1', true), point('r2', false)] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const urls = () => fetchMock.mock.calls.map(([u]) => new URL(u as string, 'http://x'));

describe('TrendCard', () => {
  it('shows the "prompt set changed" legend and refetches on range and platform changes', async () => {
    const { rerender } = renderWithProviders(<TrendCard brandId="b1" platform={null} />);
    expect(await screen.findByText(/Prompt set or platforms changed \(1 run\)/)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // runs analyzed

    const first = urls()[0]!;
    expect(first.pathname).toBe('/api/brands/b1/insights/trend');
    expect(first.searchParams.get('platform')).toBeNull();
    const from90 = first.searchParams.get('from')!;

    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: '30' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const from30 = urls()[1]!.searchParams.get('from')!;
    expect(new Date(from30).getTime() - new Date(from90).getTime()).toBe(60 * 86_400_000);

    rerender(<TrendCard brandId="b1" platform="gemini" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(urls()[2]!.searchParams.get('platform')).toBe('gemini');
  });
});
