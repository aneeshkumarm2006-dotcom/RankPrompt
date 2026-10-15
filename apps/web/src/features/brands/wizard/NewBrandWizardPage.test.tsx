// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { makeBrand, makeMe, makePrompt, stubApi } from '../testFixtures';
import { NewBrandWizardPage } from './NewBrandWizardPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewBrandWizardPage resume (F-10)', () => {
  it('opens step 1 without a brand id', async () => {
    stubApi({ '/me': makeMe() });
    renderWithProviders(<NewBrandWizardPage />, { route: '/app/brands/new' });
    expect(await screen.findByRole('button', { name: /Analyze brand/ })).toBeTruthy();
  });

  it('resumes at step 2 for a brand without prompts', async () => {
    stubApi({ '/me': makeMe(), '/brands/b1': makeBrand(), '/brands/b1/prompts': [] });
    renderWithProviders(<NewBrandWizardPage />, { route: '/app/brands/new?brandId=b1' });
    expect(await screen.findByRole('button', { name: /Generate 25 prompts/ })).toBeTruthy();
    expect(
      within(screen.getByRole('navigation', { name: 'Setup progress' }))
        .getByText('Categories')
        .closest('li')
        ?.getAttribute('aria-current'),
    ).toBe('step');
  });

  it('resumes at step 3 with the saved prompts and "Continue to run setup"', async () => {
    stubApi({
      '/me': makeMe(),
      '/brands/b1': makeBrand(),
      '/brands/b1/prompts': [makePrompt(), makePrompt({ id: 'p2', text: 'Cheapest rockets?' })],
    });
    renderWithProviders(<NewBrandWizardPage />, { route: '/app/brands/new?brandId=b1' });
    expect(await screen.findByText('Saved prompts (2)')).toBeTruthy();
    expect(screen.getByText('Cheapest rockets?')).toBeTruthy();
    const next = screen.getByRole('button', { name: /Continue to run setup/ });
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('refuses to continue an archived brand', async () => {
    stubApi({
      '/me': makeMe(),
      '/brands/b1': makeBrand({ archivedAt: '2026-10-05T10:00:00.000Z' }),
      '/brands/b1/prompts': [],
    });
    renderWithProviders(<NewBrandWizardPage />, { route: '/app/brands/new?brandId=b1' });
    expect(await screen.findByText('This brand is archived')).toBeTruthy();
  });
});
