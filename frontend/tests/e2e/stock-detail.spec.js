import { expect, test } from '@playwright/test';

test('stock detail critical path renders the main research surfaces', async ({ page }) => {
  await page.goto('/stock/AAPL');

  await expect(page.getByRole('heading', { name: 'About Apple Inc.' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();

  await page.getByRole('tab', { name: 'Financials' }).click();
  await expect(page.getByRole('heading', { name: 'Revenue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'More Metrics' })).toBeVisible();

  await page.getByRole('tab', { name: 'Price' }).click();
  await expect(page.getByText('Adjusted close')).toBeVisible();
  await expect(page.getByRole('button', { name: '1Y' })).toBeVisible();

  await page.getByRole('tab', { name: 'DCF Calculator' }).click();
  await expect(page.getByRole('heading', { name: 'Assumptions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '5-Year Projection' })).toBeVisible();

  await page.getByRole('tab', { name: 'AI' }).click();
  await expect(page.getByText(/free: 10\/day/i)).toBeVisible();
  await expect(page.getByText(/sign in: 50\/day/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ask a question...' })).toBeVisible();
});
