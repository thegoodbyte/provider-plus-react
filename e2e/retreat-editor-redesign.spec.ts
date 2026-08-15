import { expect, test } from '@playwright/test';

const retreatId = '507f1f77bcf86cd799439490';
const retreat = { _id: retreatId, name: 'JNO-08-22-26', code: 'JNO-08-22-26', status: 'upcoming', startDate: '2026-08-22T12:00:00.000Z', endDate: '2026-08-29T12:00:00.000Z', startTime: '18:00', endTime: '09:00', location_town: 'Mistrovice', capacity: 6, currentOccupancy: 4, ceremonyCount: 2, type: 'regular', houseId: 'house-1', backgroundColor: '#2563eb', textColor: '#ffffff' };

test.describe('PPVC-490 retreat editor redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }));
    });
    await page.route('**', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.port === '3000') return route.continue();
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === `/retreats/${retreatId}`) return route.fulfill({ json: retreat });
      if (url.pathname === '/houses') return route.fulfill({ json: [{ _id: 'house-1', name: 'Mistrovice House', address: 'Mistrovice 107', generalTown: 'Mistrovice' }] });
      return route.fulfill({ json: [] });
    });
  });

  test('shows the numbered desktop layout and retreat preview', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin/retreats/${retreatId}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit retreat' })).toBeVisible();
    for (const title of ['Identity', 'Schedule', 'Place and capacity', 'Colour code']) await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText('4 / 6 places', { exact: true })).toBeVisible();
    await expect(page.getByText('Calendar dot and booking row accent')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete retreat' })).toBeVisible();
  });

  test('stacks fields and keeps save actions accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/retreats/${retreatId}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit retreat' })).toBeVisible();
    await expect(page.getByLabel('Start date')).toBeVisible();
    await expect(page.getByLabel('End date')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete retreat' })).toBeHidden();
  });
});
