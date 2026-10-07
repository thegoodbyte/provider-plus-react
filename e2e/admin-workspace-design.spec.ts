import { test, expect } from '@playwright/test';
import { mockNavigationApi } from './helpers/mock-navigation-api';

test.beforeEach(async ({ page }) => { await mockNavigationApi(page); });

test('shortcut search filters destinations and recovers from no results', async ({ page }) => {
  await page.goto('/admin/launcher');
  const search = page.getByLabel('Find a shortcut', { exact: true });
  await search.fill('no-such-workspace');
  await expect(page.getByRole('status')).toContainText('No matching daily shortcuts');
  await search.fill('Bookings');
  const daily = page.getByRole('region', { name: 'Daily Work' });
  await expect(daily.getByRole('button', { name: 'Clients', exact: true })).toHaveCount(0);
  await daily.getByRole('button', { name: 'Bookings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible();
});

test('mobile drawer traps focus, closes with Escape, and restores its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/launcher');
  const trigger = page.getByRole('button', { name: 'Toggle menu', exact: true });
  await trigger.click();
  const close = page.getByRole('button', { name: 'Close menu', exact: true });
  await expect(close).toBeFocused();
  await close.press('Shift+Tab');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Sign Out' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

test('currency dialog focuses lazy content and supports keyboard dismissal', async ({ page }) => {
  await page.goto('/admin/launcher');
  const account = page.getByLabel('Account and tools');
  await account.click();
  await page.getByRole('button', { name: 'Currency converter', exact: true }).click();
  const close = page.getByRole('button', { name: 'Close currency converter' });
  await expect(close).toBeFocused();
  await close.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Currency settings' })).toHaveCount(0);
});

test('mobile requirements filters fit inside the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/booking-flow');
  await expect(page.getByRole('heading', { name: 'Booking Requirements', exact: true })).toBeVisible();
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
