import { expect, test } from '@playwright/test';
import { lastEmail, register, uid } from './helpers';

/**
 * Billing in test mode (TODO 8.5) against the e2e server's fake Stripe: checkout and the portal
 * open its hosted pages, and "Pay" delivers the same signed webhook events Stripe would, through
 * the real `/api/stripe/webhook`. Credits must arrive through the webhook, not the redirect.
 */
test('billing: verify email → top-up → subscribe → portal', async ({ page }) => {
  const email = `billing-${uid()}@example.com`;
  await register(page, email);
  const credits = page.getByTestId('sidebar-credits');
  await expect(credits).toHaveText('50 available');

  await test.step('buying needs a verified email', async () => {
    await page.goto('/app/billing');
    await page.getByRole('button', { name: 'Buy for $20' }).click();
    await expect(page.getByText('Please verify your email address first.')).toBeVisible();
    await expect(page).toHaveURL(/\/app\/billing$/);
  });

  await test.step('verify the email from the link in the email', async () => {
    const text = await lastEmail(page, email, 'verify_email');
    const link = /https?:\/\/\S+verify-email\?token=[\w-]+/.exec(text)?.[0];
    expect(link).toBeTruthy();
    await page.goto(new URL(link ?? '').pathname + new URL(link ?? '').search);
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
  });

  await test.step('top-up: checkout → pay → back with 50 more credits', async () => {
    await page.goto('/app/billing');
    await page.getByRole('button', { name: 'Buy for $20' }).click();
    await expect(page.getByRole('heading', { name: 'Fake Stripe Checkout' })).toBeVisible();
    await page.getByRole('link', { name: 'Pay with a test card' }).click();
    await expect(page).toHaveURL(/\/app\/billing$/);
    await expect(page.getByText('Payment received. Your credits have been added.')).toBeVisible();
    await expect(credits).toHaveText('100 available');
  });

  await test.step('a canceled checkout charges nothing', async () => {
    await page.getByRole('button', { name: 'Buy for $40' }).click();
    await page.getByRole('link', { name: 'Cancel' }).click();
    await expect(page.getByText('Checkout canceled. You have not been charged.')).toBeVisible();
    await expect(credits).toHaveText('100 available');
  });

  await test.step('subscribe to Starter: plan credits arrive, purchased credits stay', async () => {
    const starter = page
      .locator('div', { has: page.getByRole('heading', { name: 'Starter' }) })
      .last();
    await starter.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByRole('heading', { name: 'Fake Stripe Checkout' })).toBeVisible();
    await page.getByRole('link', { name: 'Pay with a test card' }).click();
    await expect(page.getByText('Subscription started.')).toBeVisible();
    await expect(credits).toHaveText('250 available'); // 150 plan + 100 purchased
    await expect(page.getByRole('button', { name: 'Current plan' })).toBeVisible();
    await expect(page.getByText(/^Renews on /)).toBeVisible();
  });

  await test.step('manage subscription opens the billing portal', async () => {
    await page.getByRole('button', { name: 'Manage subscription' }).click();
    await expect(page.getByRole('heading', { name: 'Fake Stripe billing portal' })).toBeVisible();
    await page.getByRole('link', { name: 'Return to PromptVerse' }).click();
    await expect(page).toHaveURL(/\/app\/billing$/);
  });
});
