// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { LoginPage } from './LoginPage';
import { apiError, jsonResponse, meFixture, mockApi, sentBody } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app/brands" element={<p>Brands</p>} />
      <Route path="/app/runs/:id" element={<p>Run page</p>} />
    </Routes>,
    { route },
  );
}

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email address'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage', () => {
  it('signs in and goes to ?next=', async () => {
    const fetchMock = mockApi({ 'POST /auth/login': () => jsonResponse(200, meFixture) });
    renderAt('/login?next=%2Fapp%2Fruns%2Fr1');

    await signIn('jane@example.com', 'whatever-it-is');

    expect(await screen.findByText('Run page')).toBeTruthy();
    expect(sentBody(fetchMock, 'POST', '/auth/login')).toEqual({
      email: 'jane@example.com',
      password: 'whatever-it-is',
    });
  });

  it('ignores an off-site ?next=', async () => {
    mockApi({ 'POST /auth/login': () => jsonResponse(200, meFixture) });
    renderAt('/login?next=%2F%2Fevil.example');
    await signIn('jane@example.com', 'whatever-it-is');
    expect(await screen.findByText('Brands')).toBeTruthy();
  });

  it('shows a generic message for wrong credentials', async () => {
    mockApi({
      'POST /auth/login': () => apiError(401, 'INVALID_CREDENTIALS', 'No user with that email'),
    });
    renderAt('/login');
    await signIn('jane@example.com', 'wrong-password');

    expect((await screen.findByRole('alert')).textContent).toBe('Email or password is incorrect');
    expect(screen.queryByText('No user with that email')).toBeNull();
  });

  it('shows the rate-limit message from the server', async () => {
    mockApi({
      'POST /auth/login': () => apiError(429, 'RATE_LIMITED', 'Too many attempts. Try later.'),
    });
    renderAt('/login');
    await signIn('jane@example.com', 'wrong-password');
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Try later.');
  });

  it('sends a signed-in visitor straight on', async () => {
    mockApi({ 'GET /me': () => jsonResponse(200, meFixture) });
    renderAt('/login');
    expect(await screen.findByText('Brands')).toBeTruthy();
  });
});
