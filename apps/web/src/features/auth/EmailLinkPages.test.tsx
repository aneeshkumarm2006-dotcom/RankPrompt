// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { apiError, mockApi, sentBody } from './testing';
import { VerifyEmailPage } from './VerifyEmailPage';

const TOKEN = 'a'.repeat(32);
const noContent = () => new Response(null, { status: 204 });
const invalidLink = () =>
  apiError(
    400,
    'VALIDATION_FAILED',
    'This link is invalid or has expired. Please request a new one.',
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VerifyEmailPage', () => {
  it('verifies the token exactly once, even in StrictMode', async () => {
    const fetchMock = mockApi({ 'POST /auth/verify-email': noContent });
    renderWithProviders(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
      { route: `/verify-email?token=${TOKEN}` },
    );

    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeTruthy();
    const calls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/verify-email');
    expect(calls).toHaveLength(1);
    expect(sentBody(fetchMock, 'POST', '/auth/verify-email')).toEqual({ token: TOKEN });
  });

  it('shows the invalid-link state when the server rejects the token', async () => {
    mockApi({ 'POST /auth/verify-email': invalidLink });
    renderWithProviders(<VerifyEmailPage />, { route: `/verify-email?token=${TOKEN}` });
    expect(await screen.findByRole('heading', { name: /link doesn’t work/ })).toBeTruthy();
  });

  it('does not call the API without a token', async () => {
    const fetchMock = mockApi();
    renderWithProviders(<VerifyEmailPage />, { route: '/verify-email' });
    expect(await screen.findByRole('heading', { name: /link doesn’t work/ })).toBeTruthy();
    expect(sentBody(fetchMock, 'POST', '/auth/verify-email')).toBeUndefined();
  });
});

describe('ForgotPasswordPage', () => {
  it('always confirms without revealing whether the account exists', async () => {
    const fetchMock = mockApi({ 'POST /auth/forgot-password': noContent });
    renderWithProviders(<ForgotPasswordPage />, { route: '/forgot-password' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/If an account exists for/)).toBeTruthy();
    expect(sentBody(fetchMock, 'POST', '/auth/forgot-password')).toEqual({
      email: 'nobody@example.com',
    });
  });
});

describe('ResetPasswordPage', () => {
  function renderAt(route: string) {
    return renderWithProviders(
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>,
      { route },
    );
  }

  async function submit(password: string, confirm = password) {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('New password'), password);
    await user.type(screen.getByLabelText('Confirm new password'), confirm);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
  }

  it('sets the new password and goes to login', async () => {
    const fetchMock = mockApi({ 'POST /auth/reset-password': noContent });
    renderAt(`/reset-password?token=${TOKEN}`);
    await submit('correct-horse-battery');

    expect(await screen.findByText('Login page')).toBeTruthy();
    expect(sentBody(fetchMock, 'POST', '/auth/reset-password')).toEqual({
      token: TOKEN,
      password: 'correct-horse-battery',
    });
  });

  it('checks the confirmation on the client', async () => {
    const fetchMock = mockApi({ 'POST /auth/reset-password': noContent });
    renderAt(`/reset-password?token=${TOKEN}`);
    await submit('correct-horse-battery', 'something-else-1');

    expect(await screen.findByText('Passwords do not match')).toBeTruthy();
    expect(sentBody(fetchMock, 'POST', '/auth/reset-password')).toBeUndefined();
  });

  it('switches to the invalid-link state when the token is rejected', async () => {
    mockApi({ 'POST /auth/reset-password': invalidLink });
    renderAt(`/reset-password?token=${TOKEN}`);
    await submit('correct-horse-battery');

    expect(await screen.findByRole('heading', { name: /link doesn’t work/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Request a new link' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });
});
