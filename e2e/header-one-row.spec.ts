import { test, expect } from '@playwright/test';
import { mockNavigationApi } from './helpers/mock-navigation-api';

for (const width of [1440, 768, 390]) {
  test(`header controls and responsive layout at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockNavigationApi(page);
    await page.route('**/environment/status', route => route.fulfill({ json: { production: true } }));
    await page.goto('/admin/launcher');
    const header = page.locator('header.workspace-header');
    await expect(header.getByText('Production', { exact: true })).toBeVisible();
    await expect(page.getByText('Production', { exact: true })).toHaveCount(1);
    await expect(header.getByRole('textbox', { name: 'Global search' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Quick Menu' })).toBeVisible();
    const mode = header.getByLabel('Work mode', { exact: true });
    await mode.click();
    await expect(page.getByRole('button', { name: 'Choose work mode', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(header.locator('.workspace-mode-select')).not.toHaveAttribute('open');
    await mode.click();
    await page.getByRole('button', { name: 'Choose work mode', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/focus$/);
    await expect(page.getByRole('heading', { name: 'What would you like to focus on?' })).toBeVisible();
    await mode.click();
    await page.getByRole('button', { name: 'All tools', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/launcher$/);
    await page.reload();
    await expect(mode).toContainText('All tools');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) {
      const leading = await header.locator('.workspace-header-leading').boundingBox();
      const search = await header.locator('.workspace-search').boundingBox();
      const tools = await header.locator('.workspace-header-tools').boundingBox();
      expect(leading && search && tools).toBeTruthy();
      expect(Math.abs((leading!.y + leading!.height / 2) - (search!.y + search!.height / 2))).toBeLessThan(4);
      expect(leading!.x + leading!.width).toBeLessThanOrEqual(search!.x + 1);
      expect(search!.x + search!.width).toBeLessThanOrEqual(tools!.x + 1);
    }
    await page.screenshot({ path: info.outputPath('header.png'), fullPage: false });
  });
}
