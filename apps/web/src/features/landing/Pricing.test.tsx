// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../app/theme/ThemeContext';
import { renderWithProviders } from '../../test/render';
import { jsonResponse, meFixture, mockApi } from '../auth/testing';
import { Navbar } from './Navbar';
import { Pricing } from './Pricing';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Pricing', () => {
  it('renders paid plans and the signup bonus from GET /plans', async () => {
    mockApi();
    renderWithProviders(<Pricing />);

    const starter = (await screen.findByRole('heading', { name: 'Starter' })).parentElement!;
    expect(within(starter).getByText('$123')).toBeTruthy();
    expect(within(starter).getByText('777 credits/month')).toBeTruthy();
    expect(within(starter).getByText('Up to 4 brands')).toBeTruthy();
    expect(within(starter).getByText('Up to 60 prompts per run')).toBeTruthy();
    expect(within(starter).getByText('2 AI platforms (ChatGPT, Perplexity)')).toBeTruthy();

    const pro = screen.getByRole('heading', { name: 'Pro' }).parentElement!;
    expect(within(pro).getByText('Up to 1 brand')).toBeTruthy();
    expect(within(pro).getByText(/^All AI platforms/)).toBeTruthy();

    // The free tier is the signup-bonus note, not a $0 card.
    expect(screen.queryByRole('heading', { name: 'Free' })).toBeNull();
    expect(screen.getByText('42 free credits')).toBeTruthy();

    // F-01: no unconfirmed guarantees.
    expect(screen.queryByText(/money-back/i)).toBeNull();

    const ctas = screen.getAllByRole('link', { name: /get started with/i });
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) expect(cta.getAttribute('href')).toBe('/register');
  });

  it('shows an error with retry when plans fail to load', async () => {
    mockApi({
      'GET /plans': () => jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Gone' } }),
    });
    renderWithProviders(<Pricing />);
    expect(await screen.findByText('Could not load pricing')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('Navbar', () => {
  it('offers sign in and sign up when signed out', async () => {
    mockApi();
    renderWithProviders(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );
    expect(await screen.findByRole('link', { name: 'Sign In' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Get Started Free' }).getAttribute('href')).toBe(
      '/register',
    );
    expect(screen.queryByRole('link', { name: 'Go to app' })).toBeNull();
  });

  it('links to the app when signed in', async () => {
    mockApi({ 'GET /me': () => jsonResponse(200, meFixture) });
    renderWithProviders(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );
    const link = await screen.findByRole('link', { name: 'Go to app' });
    expect(link.getAttribute('href')).toBe('/app/brands');
    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
  });
});
