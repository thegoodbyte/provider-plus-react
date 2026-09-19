import { test, expect, Page } from '@playwright/test';
import { mockNavigationApi } from './helpers/mock-navigation-api';

// Chunk filenames and CSS extraction differ in the development server.
test.skip(process.env.PLAYWRIGHT_PRODUCTION_BUILD !== '1', 'Run against a production build; see docs/performance/PPVC-636.md.');

// Exercise actual production chunks with deterministic APIs; no real email or data writes.
async function navigateFromMenu(page: Page, label: string) {
  await page.getByPlaceholder('Filter menu...').fill(label);
  await page.locator('nav ul ul').getByRole('button', { name: label, exact: true }).click();
}

test.beforeEach(async ({ page }) => { await mockNavigationApi(page); });

const screens = [
  { path: 'analytics', menu: 'Analytics', heading: 'Analytics', chunk: 'AnalyticsPage' },
  { path: 'communications', menu: 'Communications', heading: 'Communications', chunk: 'CommunicationsPage' },
  { path: 'users', menu: 'User Management', heading: 'User Management', chunk: 'UserManagement' },
  { path: 'medical-artifacts', menu: 'Medical Artifacts', heading: 'Medical Artifacts', chunk: 'MedicalArtifactsPage' },
];

test('launcher defers secondary chunks; menu transitions load them on demand and support back/forward', async ({ page }) => {
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin/launcher');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  expect(scripts.filter(url => /(?:Medical|CommunicationsPage|AnalyticsPage|UserManagement|AnnouncementsPage|CurrencySettings)/.test(url))).toEqual([]);
  for (const screen of screens) {
    await navigateFromMenu(page, screen.menu);
    await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
    expect(scripts.some(url => url.includes(`/${screen.chunk}.`))).toBe(true);
  }
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Medical Artifacts', exact: true })).toBeVisible();
  expect(scripts.filter(url => url.includes('/UserManagement.'))).toHaveLength(1);
  expect(errors).toEqual([]);
});

for (const screen of screens) {
  test(`direct link and reload: ${screen.path}`, async ({ page }) => {
    await page.goto(`/admin/${screen.path}`);
    await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible();
  });
}

test('slow chunk shows a loading state while the application menu remains usable', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/AnalyticsPage.*.chunk.js', async route => { await held; await route.continue(); });
  await page.goto('/admin/launcher');
  try {
    await navigateFromMenu(page, 'Analytics');
    await expect(page.getByRole('status').filter({ hasText: 'Loading page…' })).toBeVisible();
    await expect(page.getByPlaceholder('Filter menu...')).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
});

for (const extension of ['js', 'css']) {
  test(`failed ${extension} chunk can recover by reloading the same direct link`, async ({ page }) => {
    const pattern = `**/AnalyticsPage.*.chunk.${extension}`;
    await page.route(pattern, route => route.abort('failed'));
    await page.goto('/admin/analytics');
    await expect(page.getByRole('alert')).toContainText('This page couldn’t load');
    await expect(page.getByPlaceholder('Filter menu...')).toBeVisible();
    await page.unroute(pattern);
    await page.getByRole('button', { name: 'Reload page' }).click();
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/analytics$/);
  });
}

test('failed chunk does not prevent navigating to another screen', async ({ page }) => {
  await page.route('**/AnalyticsPage.*.chunk.js', route => route.abort('failed'));
  await page.goto('/admin/analytics');
  await expect(page.getByRole('alert')).toContainText('This page couldn’t load');
  await navigateFromMenu(page, 'User Management');
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('restricted role cannot load an administration chunk', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ id: 'staff', role: 'facilitator', email: 'test@example.test' })));
  const scripts: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/unauthorized$/);
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toHaveCount(0);
  expect(scripts.some(url => url.includes('/UserManagement.'))).toBe(false);
});

test('medical advisor can open their dashboard directly', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ id: 'advisor', role: 'medical_advisor', email: 'test@example.test' })));
  await page.goto('/medical/medical-dashboard');
  await expect(page.getByRole('heading', { name: 'Medical Dashboard', exact: true })).toBeVisible();
});

test('public medical link loads without an authenticated session', async ({ page }) => {
  await page.addInitScript(() => { localStorage.removeItem('user'); localStorage.removeItem('token'); });
  await page.goto('/medical/review-link/test-token');
  await expect(page.getByRole('heading', { name: 'Medical Review Request #123', exact: true })).toBeVisible();
});

test('core navigation remains available before and after visiting a lazy screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin/launcher');
  for (const name of ['Clients', 'Retreats', 'Bookings', 'Payment Requests', 'Analytics', 'Clients']) {
    await navigateFromMenu(page, name);
    await expect(page.getByRole('heading', { name: name === 'Analytics' ? 'Analytics' : name, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('unauthenticated direct links show login without loading protected chunks', async ({ page }) => {
  await page.addInitScript(() => { localStorage.removeItem('user'); localStorage.removeItem('token'); });
  const scripts: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await page.goto('/admin/users');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect(scripts.some(url => url.includes('/UserManagement.'))).toBe(false);
});
