import { expect, test } from '@playwright/test';

test('landing page exposes the search-first experience', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /stockpulse/i }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder('Search by ticker or company name...'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'AAPL', exact: true })).toBeVisible();
  await expect(
    page.getByText(/500 companies/i),
  ).toBeVisible();
});

test('landing search leads into the stock detail financials hero flow', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('Search by ticker or company name...').fill('AAPL');
  await expect(page.getByRole('option', { name: /AAPL Apple/i })).toBeVisible();

  await page.getByRole('option', { name: /AAPL Apple/i }).click();
  await expect(page).toHaveURL(/\/stock\/AAPL$/);

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

test('valuation tab shows annualized return framing', async ({ page }) => {
  await page.goto('/stock/AAPL');

  await page.getByRole('tab', { name: 'DCF Calculator' }).click();

  await expect(page.getByText(/Implied CAGR vs Today/i)).toBeVisible();
  await expect(page.getByText(/Total 5-year return:/i)).toBeVisible();
});

test('AI tab streams an answer and shows stream metadata', async ({ page }) => {
  await page.route('**/api/companies/AAPL/copilot/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
      body: [
        'data: {"type":"meta","company_name":"Apple Inc.","quote_freshness":"Quote updated 5m ago","coverage_summary":"Coverage: 10 annual, 8 quarterly","remaining_quota":8}\n\n',
        'data: {"type":"text","content":"Apple keeps compounding with stable margins."}\n\n',
        'data: {"type":"done","remaining_quota":8}\n\n',
      ].join(''),
    });
  });

  await page.goto('/stock/AAPL');
  await page.getByRole('tab', { name: 'AI' }).click();
  await page.getByRole('button', { name: 'Summarize key financial trends' }).click();

  await expect(page.getByText(/Apple keeps compounding with stable margins\./i)).toBeVisible();
  await expect(page.getByText(/8 left today/i)).toBeVisible();
  await expect(page.getByText(/Coverage: 10 annual, 8 quarterly/i)).toBeVisible();
});

test('AI tab shows the upgrade CTA when anonymous quota is exhausted', async ({ page }) => {
  await page.route('**/api/companies/AAPL/copilot/**', async (route) => {
    await route.fulfill({
      status: 429,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Daily limit reached',
        message: 'You have used all 10 free prompts today.',
        code: 'quota_exhausted',
        limit: 10,
        used: 10,
      }),
    });
  });

  await page.goto('/stock/AAPL');
  await page.getByRole('tab', { name: 'AI' }).click();
  await page.getByRole('button', { name: 'Compare margins to sector average' }).click();

  await expect(page.getByText(/used all 10 free prompts today/i)).toBeVisible();
  await page.getByRole('button', { name: /sign in for 50 daily prompts/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('screener filters into a company detail flow', async ({ page }) => {
  await page.goto('/screener');

  await page.getByRole('combobox').selectOption('Information Technology');
  await page.getByRole('button', { name: /apply filters/i }).click();

  await expect(page.getByText(/result/i)).toBeVisible();
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();

  const ticker = (await firstRow.locator('td').first().innerText()).trim();
  await firstRow.click();

  await expect(page).toHaveURL(new RegExp(`/stock/${ticker}$`));
  await expect(page.getByText(ticker, { exact: true })).toBeVisible();
});

test.describe('mobile responsive flows', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('mobile screener uses the filter sheet and card results without overflow', async ({ page }) => {
    await page.goto('/screener');

    await page.getByRole('button', { name: /^filters$/i }).click();
    const filterDialog = page.getByRole('dialog', { name: /refine results/i });
    await expect(filterDialog).toBeVisible();

    await filterDialog.getByRole('combobox').selectOption('Information Technology');
    await filterDialog.getByRole('button', { name: /apply filters/i }).click();
    await expect(filterDialog).toHaveCount(0);

    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByText(/tap a company card to jump into the full detail view/i)).toBeVisible();

    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  });

  test('mobile stock detail keeps tabs and copilot input usable without overflow', async ({ page }) => {
    await page.goto('/stock/AAPL');

    await expect(page.getByRole('tab', { name: 'Financials' })).toBeVisible();
    await page.getByRole('tab', { name: 'AI' }).click();
    await expect(page.getByPlaceholder('Ask a question...')).toBeVisible();

    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  });
});

test('invalid ticker renders the search-facing not-found state', async ({ page }) => {
  await page.goto('/stock/INVALIDTICKER');

  await expect(page.getByText(/company not found for ticker/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /back to search/i })).toBeVisible();
});

test('auth modal supports register, login, and logout', async ({ page }) => {
  const email = `oracle+${Date.now()}@example.com`;
  const password = 'StockPulse123!';

  await page.goto('/');

  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: /create account/i }).click();
  await page.getByRole('button', { name: /use email instead/i }).click();
  await page.getByLabel('Name').fill('Oracle User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('form').getByRole('button', { name: /^create account$/i }).click();

  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  await expect(page.getByText(/oracle user/i)).toBeVisible();

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();

  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.getByRole('button', { name: /use email instead/i }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in with email/i }).click();

  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  await expect(page.getByText(/50 ai prompts\/day/i)).toBeVisible();
});

test('google sign-in completes through the local mock consent flow', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.getByRole('button', { name: /continue with google/i }).click();

  await expect(page).toHaveURL(/\/api\/auth\/google\/mock-consent/);
  await expect(page.getByRole('heading', { name: /continue with google/i })).toBeVisible();

  await page.getByRole('button', { name: /continue as/i }).click();

  await expect.poll(() => {
    const current = new URL(page.url());
    return current.pathname;
  }).toBe('/');
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  await expect(page.getByText(/demo user/i)).toBeVisible();
});

test('password reset request and confirm routes support account recovery', async ({ page }) => {
  await page.route('**/api/auth/password-reset/request/', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'If an account exists for that email, we sent a reset link.',
      }),
    });
  });

  await page.route('**/api/auth/password-reset/confirm/', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Password updated. Sign in with your new password.',
      }),
    });
  });

  await page.goto('/reset-password');
  await page.getByLabel('Email').fill('oracle@example.com');
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible();

  await page.goto('/reset-password?uid=test-uid&token=test-token');
  await page.getByLabel('New password').fill('NewStockPulse123!');
  await page.getByLabel('Confirm password').fill('NewStockPulse123!');
  await page.getByRole('button', { name: /update password/i }).click();
  await expect(page.getByRole('heading', { name: /you can sign in now/i })).toBeVisible();
});
