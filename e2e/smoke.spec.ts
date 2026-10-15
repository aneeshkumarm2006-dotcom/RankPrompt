import { expect, test } from '@playwright/test';
import { register, uid } from './helpers';

/**
 * Smoke (TODO 5.14, 7.1): signup → brand (wizard) → run (fake providers) → report → schedule →
 * share.
 * One test, because each step needs the previous one's state.
 */

test('signup → brand → run → report → schedule → share', async ({ page, browser }) => {
  const email = `smoke-${uid()}@example.com`;
  const brandName = `Acme ${uid()}`;

  await test.step('sign up: the sidebar shows the 50-credit signup bonus at once (F-35)', async () => {
    await register(page, email);
    await expect(page.getByTestId('sidebar-credits')).toHaveText('50 available');
  });

  await test.step('wizard: analyze and create the brand', async () => {
    await page.getByLabel('Brand name').fill(brandName);
    await page.getByLabel('Website URL').fill(`${brandName.toLowerCase().replace(' ', '-')}.com`);
    await page.getByRole('button', { name: 'Analyze brand' }).click();
    await page.getByRole('button', { name: /Create brand/ }).click();
    await expect(page).toHaveURL(/brandId=[a-f0-9]{24}/);
  });

  await test.step('wizard: generate and save one prompt', async () => {
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: /Generate 1 prompt\b/ }).click();
    await page.getByRole('button', { name: /Save 1 prompt and continue/ }).click();
  });

  await test.step('run: the estimate is 1 prompt × 5 platforms, then the run starts', async () => {
    await expect(page.getByTestId('run-estimate')).toContainText('5 credits');
    await page.getByRole('button', { name: 'Analyze visibility' }).click();
    await expect(page).toHaveURL(/\/app\/runs\/[a-f0-9]{24}$/);
  });

  await test.step('report: the run finishes and the report renders', async () => {
    await expect(page.getByText('Visibility', { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
    await expect(page.getByTestId('sidebar-credits')).toHaveText('45 available');

    await page
      .getByRole('button', { name: /Open (the answer|details)/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  await test.step('schedule: "Schedule this setup" creates a weekly schedule from the run', async () => {
    const reportUrl = page.url();
    await page.getByRole('link', { name: 'Schedule this setup' }).click();
    await expect(page).toHaveURL(/\/schedules\?fromRun=/);
    await page.getByRole('button', { name: 'Create schedule' }).click();
    await expect(page.getByText('Schedule created')).toBeVisible();
    await expect(page.getByText(/^Weekly on /).first()).toBeVisible();
    await expect(page.getByText('● Active')).toBeVisible();
    await expect(page.getByText('5 credits').first()).toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
    await page.goto(reportUrl);
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
  });

  const shareUrl = await test.step('share: create a public link', async () => {
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Create link' }).click();
    const url = await page.getByLabel('Share link').inputValue();
    expect(url).toMatch(/\/share\/[\w-]{20,}$/);
    return url;
  });

  await test.step('share: a signed-out visitor sees the read-only report', async () => {
    const visitor = await browser.newContext();
    const publicPage = await visitor.newPage();
    await publicPage.goto(new URL(shareUrl).pathname);
    await expect(publicPage.getByRole('heading', { name: brandName })).toBeVisible();
    await expect(publicPage.getByRole('button', { name: 'Share' })).toHaveCount(0);
    await expect(publicPage.getByRole('button', { name: 'Delete run' })).toHaveCount(0);
    await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await visitor.close();
  });
});

test('v1 paths redirect and unknown paths show a 404', async ({ page }) => {
  await page.goto('/shared/some-old-token-value-1234567890');
  await expect(page).toHaveURL(/\/share\/some-old-token-value-1234567890$/);

  await page.goto('/definitely-not-a-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('landing pricing comes from /plans', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('$99').first()).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
