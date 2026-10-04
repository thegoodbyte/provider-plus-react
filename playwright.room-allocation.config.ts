import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'room-allocation.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4336', browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm start -- --host 127.0.0.1 --port 4336 --strictPort',
    url: 'http://127.0.0.1:4336', reuseExistingServer: false,
  },
});
