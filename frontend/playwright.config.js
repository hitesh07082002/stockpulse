import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const externalBaseURL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL;
const baseURL = externalBaseURL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : [
        {
          command: '../venv/bin/python ../backend/manage.py runserver 127.0.0.1:8000 --noreload',
          url: 'http://127.0.0.1:8000/api/health/',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
        {
          command: `npm run dev -- --host localhost --port ${PORT}`,
          port: PORT,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      ],
});
