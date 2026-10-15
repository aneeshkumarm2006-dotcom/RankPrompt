import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke suite (TODO 5.14): the real web app against the real API with FAKE_PROVIDERS=true and a
 * throwaway in-memory database. Own ports, so it can run next to `pnpm dev`.
 */
const API_PORT = 4100;
const WEB_PORT = 5180;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/e2e-api.mjs',
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/ready`,
      env: { E2E_API_PORT: String(API_PORT), E2E_APP_URL: WEB_URL },
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `pnpm --filter @pv/web exec vite --port ${WEB_PORT} --strictPort`,
      cwd: '..',
      url: WEB_URL,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
