import { expect, test } from '@playwright/test';

test('landing page exposes the search-first experience', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /search any s&p 500 company/i }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder('Search by ticker or company name...'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'AAPL' })).toBeVisible();
});
