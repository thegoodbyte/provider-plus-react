import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'e2e/reports/results.json' }],
    ['junit', { outputFile: 'e2e/reports/results.xml' }]
  ],
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    storageState: {
      cookies: [],
      origins: [{
        origin: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        localStorage: [
          { name: 'token', value: 'e2e-token' },
          { name: 'user', value: JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }) },
        ],
      }],
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.PLAYWRIGHT_VIDEO === '1' ? 'retain-on-failure' : 'off',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/navigation.spec.ts', '**/forms-validation.spec.ts'] // Run subset in Firefox
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/client-management.spec.ts'] // Run subset in Safari
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: ['**/navigation.spec.ts', '**/client-management.spec.ts'] // Test mobile responsiveness
    },
    {
      name: 'tablet',
      use: { ...devices['iPad'] },
      testMatch: ['**/retreat-management.spec.ts'] // Test tablet responsiveness
    }
  ],

  /* Run your local dev server before starting the tests */
  ...(process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1' ? {} : {
    webServer: {
      command: process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || 'npm start',
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stderr: 'pipe',
      stdout: 'pipe',
    },
  }),
});
