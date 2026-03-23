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
  await expect(
    page.getByText(/normalized sec financial data for 500 s&p companies/i),
  ).toBeVisible();
});

test('landing search leads into the stock detail financials hero flow', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('Search by ticker or company name...').fill('AAPL');
  await expect(page.getByRole('button', { name: /AAPL Apple/i })).toBeVisible();

  await page.getByRole('button', { name: /AAPL Apple/i }).click();
  await expect(page.getByText('AAPL')).toBeVisible();

  await page.getByRole('tab', { name: 'Financials' }).click();
  await expect(page.getByRole('heading', { name: 'Revenue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'More Metrics' })).toBeVisible();
});
