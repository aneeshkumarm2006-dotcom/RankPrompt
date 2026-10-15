import { expect, type Page } from '@playwright/test';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const PASSWORD = 'smoke test password';

/** Signs up through the register page; lands on the new-brand wizard. */
export async function register(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Smoke Tester');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox').check({ force: true });
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/app\/brands\/new/);
}

/** The newest email of a template sent to `to`, from the e2e server's capture (e2e-server.ts). */
export async function lastEmail(page: Page, to: string, template: string): Promise<string> {
  let text = '';
  await expect(async () => {
    const res = await page.request.get(`/api/__e2e/emails?to=${encodeURIComponent(to)}`);
    const emails = (await res.json()) as { template: string; text: string }[];
    const hit = emails.findLast((e) => e.template === template);
    expect(hit).toBeTruthy();
    text = hit?.text ?? '';
  }).toPass({ timeout: 15_000 });
  return text;
}
