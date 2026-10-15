// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { BrandsPage } from './BrandsPage';
import { makeListItem, makeMe, stubApi } from './testFixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

const card = (name: string) => screen.getByRole('heading', { name }).closest('article')!;

describe('BrandsPage', () => {
  it('shows "Continue setup" for brands without prompts or runs, the dashboard otherwise', async () => {
    stubApi({
      '/me': makeMe(),
      '/brands': [
        makeListItem({ id: 'done', name: 'Done Co' }),
        makeListItem({ id: 'noprompts', name: 'Fresh Co', promptCount: 0, latestRun: null }),
        makeListItem({ id: 'norun', name: 'Ready Co', latestRun: null }),
      ],
    });
    renderWithProviders(<BrandsPage />, { route: '/app/brands' });

    await screen.findByRole('heading', { name: 'Done Co' });
    const setupLinks = screen.getAllByRole('link', { name: /Continue setup/ });
    expect(setupLinks.map((a) => a.getAttribute('href'))).toEqual(
      expect.arrayContaining([
        '/app/brands/new?brandId=noprompts',
        '/app/brands/new?brandId=norun',
      ]),
    );
    expect(setupLinks).toHaveLength(2);

    const done = card('Done Co');
    expect(done.querySelector('a[href="/app/brands/done"]')).toBeTruthy();
    expect(done.textContent).toContain('42%'); // the server's ratio, displayed only
    expect(card('Fresh Co').textContent).toContain('—');
  });

  it('shows the plan limit and disables "Add brand" when it is reached', async () => {
    stubApi({
      '/me': makeMe({ brands: 1, brandsUsed: 1 }),
      '/brands': [makeListItem()],
    });
    renderWithProviders(<BrandsPage />, { route: '/app/brands' });

    expect(await screen.findByText(/1 \/ 1 brands used/)).toBeTruthy();
    const add = screen.getByRole('button', { name: /Add brand/ });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('link', { name: /Upgrade plan/ }).getAttribute('href')).toBe(
      '/app/billing',
    );
  });
});
