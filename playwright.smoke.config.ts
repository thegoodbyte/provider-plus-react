import { defineConfig } from '@playwright/test';
const port = Number(process.env.SMOKE_PORT || 4310);
const dev = process.env.SMOKE_DEV === 'true';
export default defineConfig({
  testDir: './smoke', workers: 1,
  use: { baseURL: process.env.SMOKE_BASE_URL || `http://127.0.0.1:${port}` },
  webServer: process.env.SMOKE_BASE_URL ? undefined : { command: dev ? 'npm start' : 'npm run serve', port, reuseExistingServer: false, env: { PORT: String(port), BROWSER: 'none' } },
});
