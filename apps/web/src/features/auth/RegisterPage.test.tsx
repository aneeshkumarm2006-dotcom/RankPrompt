// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { RegisterPage } from './RegisterPage';
import { apiError, jsonResponse, meFixture, mockApi, sentBody } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/app/brands/new" element={<p>Wizard</p>} />
    </Routes>,
    { route },
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Full name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Email address'), 'Jane@Example.com');
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
  await user.type(screen.getByLabelText('Confirm password'), 'correct-horse-battery');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

describe('RegisterPage', () => {
  it('sends ?ref= with the signup, shows the referral note and bonus, then opens the wizard', async () => {
    const fetchMock = mockApi({ 'POST /auth/register': () => jsonResponse(201, meFixture) });
    renderAt('/register?ref=ABCD1234');

    expect(await screen.findByTestId('referral-note')).toBeTruthy();
    expect(await screen.findByText('42 free credits')).toBeTruthy();

    await fillAndSubmit();

    expect(await screen.findByText('Wizard')).toBeTruthy();
    expect(sentBody(fetchMock, 'POST', '/auth/register')).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'correct-horse-battery',
      ref: 'ABCD1234',
    });
  });

  it('sends no ref without ?ref= and validates on the client first', async () => {
    const fetchMock = mockApi({ 'POST /auth/register': () => jsonResponse(201, meFixture) });
    renderAt('/register');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Enter your name')).toBeTruthy();
    expect(screen.getByText('Please accept the Terms and Privacy Policy')).toBeTruthy();
    expect(sentBody(fetchMock, 'POST', '/auth/register')).toBeUndefined();
    expect(screen.queryByTestId('referral-note')).toBeNull();

    await fillAndSubmit();
    await screen.findByText('Wizard');
    expect(sentBody(fetchMock, 'POST', '/auth/register')).not.toHaveProperty('ref');
  });

  it('explains a taken email with a link to sign in', async () => {
    mockApi({
      'POST /auth/register': () => apiError(409, 'CONFLICT', 'Email already registered'),
    });
    renderAt('/register');
    await fillAndSubmit();

    expect(await screen.findByText(/An account with this email already exists/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in instead' }).getAttribute('href')).toBe(
      '/login',
    );
  });
});
