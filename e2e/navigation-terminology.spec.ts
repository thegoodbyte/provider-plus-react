import { test, expect } from '@playwright/test';
import { mockNavigationApi } from './helpers/mock-navigation-api';

test.beforeEach(async ({ page }) => { await mockNavigationApi(page); });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`daily work and setup are separate and usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    if (viewport.width < 768) await page.addInitScript(() => localStorage.setItem('sidebarCollapsed', 'true'));
    await page.goto('/admin/launcher');
    if (viewport.width < 768) {
      const heading = await page.getByRole('heading', { name: 'Home', exact: true }).boundingBox();
      const menu = await page.getByRole('button', { name: 'Toggle menu', exact: true }).first().boundingBox();
      expect(heading!.y).toBeGreaterThan(menu!.y + menu!.height);
    }
    const daily = page.getByRole('region', { name: 'Daily Work' });
    const setup = page.getByRole('region', { name: 'Settings & Setup' });
    for (const name of ['Clients', 'Bookings', 'Retreats', 'Medical Dashboard', 'Payments', 'Payment Requests', 'Readiness Dashboard', 'Booking Requirements']) {
      await expect(daily.getByRole('button', { name, exact: true })).toBeVisible();
    }
    for (const name of ['Booking Step Library', 'Booking Document Types', 'Retreat Readiness Setup']) {
      await expect(setup.getByRole('button', { name, exact: true })).toBeVisible();
      await expect(daily.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/ppvc-634-home-${viewport.width}.png`, fullPage: true });
    await setup.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/ppvc-634-setup-${viewport.width}.png`, fullPage: true });
    if (viewport.width < 768) await page.getByRole('button', { name: 'Toggle menu', exact: true }).first().click();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('button', { name: 'Settings & Setup', exact: true }).click();
    await expect(nav.getByRole('button', { name: 'Booking Step Library', exact: true })).toBeVisible();
    await nav.getByRole('button', { name: 'Booking Step Library', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/ppvc-634-menu-${viewport.width}.png`, fullPage: true });
    await nav.getByRole('button', { name: 'Booking Step Library', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Booking Step Library', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/retreat-flow-library$/);
    if (viewport.width < 768) await expect(nav).not.toBeInViewport();
  });
}

for (const [path, heading] of [
  ['workflow', 'Readiness Dashboard'], ['booking-flow', 'Booking Requirements'],
  ['retreat-flow', 'Retreat Readiness Setup'], ['retreat-flow-library', 'Booking Step Library'],
  ['booking-document-types', 'Booking Document Types'], ['payment-requests', 'Payment Requests'],
]) {
  test(`existing bookmark ${path} keeps resolving with the agreed heading`, async ({ page }) => {
    await page.goto(`/admin/${path}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin/${path}$`));
  });
}

test('route-to-role visibility preferences apply to both sidebar and launcher', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('navigationPermissions:v1', JSON.stringify({ users: [], 'payment-requests': [] })));
  await page.goto('/admin/launcher');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Daily Work' }).getByRole('button', { name: 'Payment Requests', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Settings & Setup' }).getByRole('button', { name: 'User Management', exact: true })).toHaveCount(0);
  await page.getByLabel('Search menu').fill('Payment Requests');
  await expect(page.getByText('No menu items found')).toBeVisible();
  await page.getByLabel('Search menu').fill('User Management');
  await expect(page.getByText('No menu items found')).toBeVisible();
});

test('medical staff sees allowed setup without administration', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('user', JSON.stringify({ id: 'medical', role: 'medical_staff', email: 'test@example.test' })));
  await page.goto('/medical/launcher');
  await expect(page.getByRole('region', { name: 'Settings & Setup' }).getByRole('button', { name: 'Booking Step Library', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Settings & Setup' }).getByRole('button', { name: 'User Management', exact: true })).toHaveCount(0);
});

test('facilitator cannot reveal administration through local preferences', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'staff', role: 'facilitator', email: 'test@example.test' }));
    localStorage.setItem('navigationPermissions:v1', JSON.stringify({ users: ['facilitator'], 'retreat-flow-library': ['facilitator'] }));
  });
  await page.goto('/staff/launcher');
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'User Management', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Booking Step Library', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Daily Work' }).getByRole('button', { name: 'Bookings', exact: true })).toBeVisible();
});
