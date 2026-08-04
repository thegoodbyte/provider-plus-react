import { test, expect } from '@playwright/test';

test.describe('Booking step deadlines page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 'admin-e2e',
        email: 'admin@example.com',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
      }));
    });
  });

  test('shows global deadlines and filters by retreat and search', async ({ page }) => {
    const items = [
      {
        _id: 'item-1',
        key: 'ekg_received',
        title: 'Entry EKG received',
        category: 'medical',
        dueDate: '2026-07-10T10:00:00.000Z',
        status: 'pending',
        bookingId: { _id: 'booking-1', bookingNumber: 21 },
        clientId: { _id: 'client-1', firstName: 'Jacek', lastName: 'Jacewicz', display_id: 1107 },
        retreatId: { _id: 'retreat-1', code: 'JNO-07-25-26', name: 'JNO Retreat' },
        notes: 'Needs review',
      },
      {
        _id: 'item-2',
        key: 'liver_received',
        title: 'Entry liver panel received',
        category: 'medical',
        dueDate: '2026-07-12T10:00:00.000Z',
        status: 'received',
        bookingId: { _id: 'booking-2', bookingNumber: 22 },
        clientId: { _id: 'client-2', firstName: 'Barbara', lastName: 'Peicher', display_id: 1018 },
        retreatId: { _id: 'retreat-2', code: 'BEN-09-22-26', name: 'Benecko' },
      },
    ];

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.port === '3000') {
        await route.continue();
        return;
      }

      if (url.pathname === '/') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }

      if (url.pathname === '/booking-flow/items') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(items) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/admin/booking-step-deadlines');
    await expect(page.getByRole('heading', { name: /Booking Step Deadlines/i })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByText('Entry EKG received')).toBeVisible();
    await expect(table.getByText('Entry liver panel received')).toBeVisible();

    await page.getByLabel('Retreat').selectOption({ label: 'JNO-07-25-26 (JNO Retreat)' });
    await expect(table.getByText('Entry EKG received')).toBeVisible();
    await expect(table.getByText('Entry liver panel received')).toHaveCount(0);

    await page.getByPlaceholder('Search retreat, step, client, booking, notes...').fill('jacek');
    await expect(table.getByText('Entry EKG received')).toBeVisible();
    await expect(table.getByText('Entry liver panel received')).toHaveCount(0);
  });
});
