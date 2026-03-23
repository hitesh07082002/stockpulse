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
  await expect(page.getByText('AAPL', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Financials' }).click();
  await expect(page.getByRole('heading', { name: 'Revenue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'More Metrics' })).toBeVisible();
});

test('price tab supports range selection', async ({ page }) => {
  await page.goto('/stock/AAPL');

  await page.getByRole('tab', { name: 'Price' }).click();
  await expect(page.getByText(/adjusted close/i)).toBeVisible();

  const fiveYearButton = page.getByRole('button', { name: '5Y' });
  await fiveYearButton.click();

  await expect(fiveYearButton).toHaveAttribute('aria-pressed', 'true');
});

test('screener filters into a company detail flow', async ({ page }) => {
  await page.goto('/screener');

  await page.getByRole('button', { name: /large >\$10b/i }).click();
  await page.getByRole('button', { name: /apply filters/i }).click();

  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();

  const ticker = (await firstRow.locator('td').first().innerText()).trim();
  await firstRow.click();

  await expect(page).toHaveURL(new RegExp(`/stock/${ticker}$`));
  await expect(page.getByText(ticker, { exact: true })).toBeVisible();
});
