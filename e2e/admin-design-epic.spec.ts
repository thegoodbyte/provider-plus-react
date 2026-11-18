import { test, expect } from '@playwright/test';

// Read-only display/filter coverage. Real-API suites cover persisted writes.
for (const width of [1440, 390]) {
  test.describe(`PPVC-1001 shared admin screens at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });
    test.beforeEach(async ({ page }) => {
      await page.route('**/*', async route => {
        if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue();
        const path = new URL(route.request().url()).pathname.replace(/^\/api(?=\/)/, '');
        const data: Record<string, unknown> = {
          '/environment/status': { environment: 'development', jobsEnabled: false },
          '/medical-review-requests/queue': [
            { _id: 'r1', display_id: 101, status: 'pending', requestType: 'ekg', clientId: { firstName: 'Anna', lastName: 'Test' }, retreatId: { name: 'Spring Retreat' } },
            { _id: 'r2', display_id: 102, status: 'approved', requestType: 'blood_pressure', clientId: { firstName: 'Ben', lastName: 'Example' }, retreatId: { name: 'Fall Retreat' } },
          ],
          '/houses': [{ _id: 'h1', name: 'Villa Sunset', city: 'Chiang Mai', capacity: 10, numberOfRooms: 5, bookingSource: 'Airbnb' }],
          '/audit-logs': { items: [{ _id: 'log1', actorEmail: 'admin@example.test', action: 'update', entityType: 'client', summary: 'Updated client record', createdAt: '2026-10-01T00:00:00Z' }], total: 1 },
        };
        await route.fulfill({ json: data[path] ?? [] });
      });
    });
    test('medical status filter keeps the correct review visible', async ({ page }, testInfo) => {
      await page.goto('/admin/medical-dashboard');
      await expect(page.getByText('Anna Test', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Approved \/ OK/ }).click();
      await expect(page.getByText('Ben Example', { exact: true })).toBeVisible();
      await expect(page.getByText('Anna Test', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('medical.png'), fullPage: true });
    });
    test('house grid retains record and booking source', async ({ page }, testInfo) => {
      await page.goto('/admin/houses');
      await expect(page.getByText('Villa Sunset', { exact: true })).toBeVisible();
      await expect(page.getByText('Airbnb', { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('houses.png'), fullPage: true });
    });
    test('audit log retains its record', async ({ page }, testInfo) => {
      await page.goto('/admin/audit-logs');
      await expect(page.getByText('Updated client record', { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('audit.png'), fullPage: true });
    });
  });
}
