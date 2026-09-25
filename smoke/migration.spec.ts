import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const portal = false;
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    if (url.pathname.includes('/auth/login')) return route.fulfill({ status: 401, json: { message: 'Invalid credentials' } });
    return route.fulfill({ json: {} });
  });
});
test('deep links reload, login mounts, and credentials use the configured API', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(portal ? '/workflow' : '/admin/clients');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.locator('input[type="email"]').fill('smoke@example.test');
  await page.locator(portal ? '#loginPin' : '#password').fill(portal ? '594827' : 'smoke-password-only');
  const request = page.waitForRequest(request => request.url().includes('/auth/login') && request.method() === 'POST');
  await page.locator('button[type="submit"]').click();
  const login = await request;
  const { loadEnv } = await import('vite');
  const env = loadEnv(process.env.SMOKE_DEV === 'true' ? 'development' : 'production', process.cwd(), 'REACT_APP_');
  const expectedUrl = portal ? (env.REACT_APP_CLIENT_PORTAL_AUTH_URL || 'http://localhost:3001/auth/login/apps/client-portal') : `${env.REACT_APP_PROVIDER_PLUS_API_URL || env.REACT_APP_API_URL || 'http://localhost:3005'}/auth/login`;
  expect(login.url()).toBe(process.env.SMOKE_AUTH_URL || expectedUrl);
  expect(login.postDataJSON()).toMatchObject({ email: 'smoke@example.test' });
  expect(errors).toEqual([]);
});
test('static assets and unknown assets have correct responses', async ({ request }) => {
  const document = await request.get('/login');
  expect(document.status()).toBe(200);
  expect(document.headers()['content-type']).toContain('text/html');
  expect((await request.get('/assets/missing-test-file.js', { headers: { Accept: 'application/javascript' } })).status()).toBe(404);
});
test('Vite hot reload updates CSS without reloading the page', async ({ page }) => {
  test.skip(process.env.SMOKE_DEV !== 'true');
  const file = resolve('src/index.css');
  const original = readFileSync(file, 'utf8');
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.evaluate(() => { (window as any).__hmrMarker = 'preserved'; });
  try {
    writeFileSync(file, original + '\nbody { --ppvc644-hmr: updated; }\n');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--ppvc644-hmr').trim())).toBe('updated');
    expect(await page.evaluate(() => (window as any).__hmrMarker)).toBe('preserved');
  } finally { writeFileSync(file, original); }
});
