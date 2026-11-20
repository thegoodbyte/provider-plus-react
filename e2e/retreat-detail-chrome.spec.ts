import { test, expect } from './fixtures/retreat-read-workspace';
for (const width of [1440, 390]) {
  test(`seven retreat toolbars retain navigation and read-only controls at ${width}px`, async ({ page, retreatRead: f }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    let roomReads = 0;
    await page.route('**/retreats/*/room-allocation', async route => {
      expect(route.request().method()).toBe('GET');
      roomReads++;
      return route.fulfill({ json: { retreatId: f.retreat._id, houseName: 'Synthetic house', houseChanged: false, revision: 0, rooms: [], guests: [] } });
    });
    await page.route('**/booking-flow/matrix/*', route => { expect(route.request().method()).toBe('GET'); return route.fulfill({ json: { bookings: f.bookings, templates: [], items: [], actionLogs: [] } }); });
    await page.route('**/announcements/retreats/*', route => { expect(route.request().method()).toBe('GET'); return route.fulfill({ json: { rules: [], deliveries: [], settings: { enabled: false }, worker: { enabled: false }, testRecipients: [] } }); });
    await page.goto('/admin/retreats/' + f.retreat._id);
    const tabs = page.locator('.retreat-detail-tabs').getByRole('tab');
    await expect(tabs.first()).toBeVisible();
    expect((await tabs.allTextContents()).slice(0, 7).map(s => s.trim())).toEqual([
      'Room allocation', 'Announcements', 'Drug Screening', 'Clients (2)', 'Reserve List', 'Retreat Readiness', 'Medical Grid',
    ]);
    for (const name of ['Expenses', 'Payments', 'Tasks']) await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
    await expect(page.getByText('2/10 spots', { exact: true })).toBeVisible();
    const shot = async (name: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${name}-${width}.png`) });
    };
    await page.getByRole('tab', { name: 'Room allocation', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Room allocation', exact: true })).toBeVisible();
    const before = roomReads;
    await page.getByRole('button', { name: 'Refresh allocations', exact: true }).click();
    await expect.poll(() => roomReads).toBeGreaterThan(before);
    await shot('rooms');
    await page.getByRole('tab', { name: 'Announcements', exact: true }).click();
    await page.getByRole('button', { name: 'Scheduled deliveries', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Scheduled deliveries', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Announcement rules', exact: true }).click();
    await shot('announcements');
    await page.getByRole('tab', { name: 'Drug Screening', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Drug Screening/i })).toBeVisible();
    await shot('screening');
    await page.getByRole('tab', { name: 'Clients (2)', exact: true }).click();
    await page.getByRole('button', { name: 'Stay planner', exact: true }).click();
    await expect(page.getByRole('button', { name: 'List', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByText('Ewa Coverage', { exact: true }).first()).toBeVisible();
    await shot('clients');
    await page.getByRole('tab', { name: 'Reserve List', exact: true }).click();
    await page.getByRole('button', { name: 'Add reservist', exact: true }).click();
    await expect(page.getByLabel('Search client', { exact: true })).toBeFocused();
    await shot('reserve');
    await page.getByRole('tab', { name: 'Retreat Readiness', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Retreat Readiness', exact: true })).toBeVisible();
    const readinessToolbar = page.getByRole('heading', { name: 'Retreat Readiness', exact: true }).locator('..').locator('..');
    await readinessToolbar.getByRole('button', { name: 'Simple', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Simple', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Detail', exact: true }).click();
    await expect(readinessToolbar.getByRole('button', { name: 'Unlock Editing', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open full screen readiness view', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen readiness view', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await shot('readiness');
    await page.getByRole('tab', { name: 'Medical Grid', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Medical Grid/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print medical grid', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Full screen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await shot('medical');
    expect(errors).toEqual([]);
    expect(f.writes()).toBe(0);
  });
}
