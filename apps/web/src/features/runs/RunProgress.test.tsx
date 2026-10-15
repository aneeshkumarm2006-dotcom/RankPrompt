// @vitest-environment jsdom
import type { RunProgress as RunProgressData } from '@pv/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { countByPlatform } from './PlatformBreakdown';
import { doneChecks, progressSegments, RunProgress } from './RunProgress';

const progress: RunProgressData = {
  total: 20,
  ok: 8,
  noAnswer: 2,
  failed: 1,
  canceled: 1,
  pending: 8,
  running: 3,
};

describe('progressSegments', () => {
  it('splits the bar into ok / no answer / failed / canceled / pending', () => {
    const segments = progressSegments(progress);
    expect(segments.map((s) => [s.key, s.count, s.width])).toEqual([
      ['ok', 8, 40],
      ['noAnswer', 2, 10],
      ['failed', 1, 5],
      ['canceled', 1, 5],
      ['pending', 8, 40],
    ]);
    expect(doneChecks(progress)).toBe(12);
  });

  it('handles an empty run without dividing by zero', () => {
    const empty = { total: 0, ok: 0, noAnswer: 0, failed: 0, canceled: 0, pending: 0, running: 0 };
    expect(progressSegments(empty).every((s) => s.width === 0)).toBe(true);
  });
});

describe('RunProgress', () => {
  it('renders only non-empty segments and the done count', () => {
    renderWithProviders(<RunProgress progress={{ ...progress, canceled: 0, pending: 9 }} />);
    const bar = screen.getByRole('progressbar');
    const keys = [...bar.querySelectorAll('[data-segment]')].map((el) =>
      el.getAttribute('data-segment'),
    );
    expect(keys).toEqual(['ok', 'noAnswer', 'failed', 'pending']);
    expect(bar.getAttribute('aria-valuenow')).toBe('11');
    expect(screen.getByText('11 / 20 checks · 55%')).toBeTruthy();
    expect((bar.querySelector('[data-segment="ok"]') as HTMLElement).style.width).toBe('40%');
  });
});

describe('countByPlatform', () => {
  it('counts loaded rows per platform and status', () => {
    const counts = countByPlatform(
      ['chatgpt', 'claude'],
      [
        { platform: 'chatgpt', status: 'ok' },
        { platform: 'chatgpt', status: 'running' },
        { platform: 'claude', status: 'failed' },
      ],
    );
    expect(counts.chatgpt.ok).toBe(1);
    expect(counts.chatgpt.running).toBe(1);
    expect(counts.claude.failed).toBe(1);
    expect(counts.claude.ok).toBe(0);
  });
});
