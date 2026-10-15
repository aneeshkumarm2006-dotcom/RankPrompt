// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROMO_DELAY_MS, PROMO_URL } from '../../lib/config';
import { emit } from '../../lib/events';
import { renderWithProviders } from '../../test/render';
import { PROMO_SHOWN_KEY, PromoPopupHost } from './PromoPopupHost';

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const dialog = () => screen.queryByRole('dialog');

describe('PromoPopupHost', () => {
  it('shows the popup PROMO_DELAY_MS after the first run, once per session', () => {
    renderWithProviders(<PromoPopupHost />);
    expect(dialog()).toBeNull();

    act(() => {
      emit('runCreated', { runId: 'r1' });
    });
    act(() => {
      vi.advanceTimersByTime(PROMO_DELAY_MS - 1);
    });
    expect(dialog()).toBeNull();
    // A second run while waiting does not restart or double the timer.
    act(() => {
      emit('runCreated', { runId: 'r2' });
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(dialog()).not.toBeNull();
    expect(sessionStorage.getItem(PROMO_SHOWN_KEY)).toBe('1');

    const cta = screen.getByRole('link', { name: 'Book a Free Call' });
    expect(cta.getAttribute('href')).toBe(PROMO_URL);
    expect(cta.getAttribute('target')).toBe('_blank');
    expect(cta.getAttribute('rel')).toBe('noopener noreferrer');

    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
    expect(dialog()).toBeNull();

    act(() => {
      emit('runCreated', { runId: 'r3' });
    });
    act(() => {
      vi.advanceTimersByTime(PROMO_DELAY_MS * 2);
    });
    expect(dialog()).toBeNull();
  });

  it('does not show again in a session where it already showed', () => {
    sessionStorage.setItem(PROMO_SHOWN_KEY, '1');
    renderWithProviders(<PromoPopupHost />);
    act(() => {
      emit('runCreated', { runId: 'r1' });
    });
    act(() => {
      vi.advanceTimersByTime(PROMO_DELAY_MS);
    });
    expect(dialog()).toBeNull();
  });

  it('clears the pending timer on unmount', () => {
    const { unmount } = renderWithProviders(<PromoPopupHost />);
    act(() => {
      emit('runCreated', { runId: 'r1' });
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(PROMO_DELAY_MS);
    });
    expect(sessionStorage.getItem(PROMO_SHOWN_KEY)).toBeNull();
  });
});
