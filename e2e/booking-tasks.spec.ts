import { test, expect } from '@playwright/test';

const bookingId = '507f1f77bcf86cd799439011';
const clientId = '507f1f77bcf86cd799439012';
const retreatId = '507f1f77bcf86cd799439013';

test.describe('Booking tasks', () => {
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

  test('creates a task from booking detail with booking, client, and retreat context', async ({ page }) => {
    let createdTaskPayload: any = null;

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

      if (url.pathname === `/bookings/${bookingId}`) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            _id: bookingId,
            bookingNumber: 1247,
            bookingType: 'full',
            status: 'confirmed',
            totalAmount: 45000,
            currency: 'CZK',
            registrationDate: '2026-06-24T00:00:00.000Z',
            clientId: {
              _id: clientId,
              firstName: 'Denis',
              lastName: 'Solomon',
              email: 'denis@example.com',
              display_id: 1187,
              language: 'pl',
            },
            retreatId: {
              _id: retreatId,
              name: 'BEN-09-22-26',
              code: 'BEN-09-22-26',
              location_town: 'Jablonne nad Orlici',
              startDate: '2026-09-22T00:00:00.000Z',
              endDate: '2026-09-29T00:00:00.000Z',
            },
          }),
        });
        return;
      }

      if (url.pathname === '/tasks' && request.method() === 'GET') {
        expect(url.searchParams.get('bookingId')).toBe(bookingId);
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname === '/tasks' && request.method() === 'POST') {
        createdTaskPayload = request.postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'task-1',
            ...createdTaskPayload,
            bookingId: { _id: bookingId, bookingNumber: 1247 },
            clientId: { _id: clientId, firstName: 'Denis', lastName: 'Solomon', display_id: 1187 },
            retreatId: { _id: retreatId, name: 'BEN-09-22-26', code: 'BEN-09-22-26' },
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
        return;
      }

      if (url.pathname === '/clients') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([{ _id: clientId, firstName: 'Denis', lastName: 'Solomon', display_id: 1187 }]),
        });
        return;
      }

      if (url.pathname === '/retreats') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([{ _id: retreatId, name: 'BEN-09-22-26', code: 'BEN-09-22-26' }]),
        });
        return;
      }

      if (url.pathname.startsWith('/booking-flow/') || url.pathname === '/booking-flow/items') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname.startsWith('/medical-artifacts') || url.pathname.startsWith('/medical-review-requests') || url.pathname.startsWith('/ceremonies')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(page.getByRole('heading', { name: /Booking #1247/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Tasks' }).click();
    await expect(page.getByText('No tasks found')).toBeVisible();

    await page.getByRole('button', { name: 'Add Task' }).click();
    const contextBanner = page.locator('.task-context-banner');
    await expect(contextBanner.getByText('Booking', { exact: true })).toBeVisible();
    await expect(contextBanner.getByText('#1247')).toBeVisible();

    await page.getByLabel('Task Name *').fill('Confirm arrival time');
    await page.getByLabel('Description *').fill('Call client before check-in.');
    await page.getByRole('button', { name: 'Create Task' }).click();

    await expect.poll(() => createdTaskPayload).toMatchObject({
      name: 'Confirm arrival time',
      description: 'Call client before check-in.',
      bookingId,
      clientId,
      retreatId,
    });
  });
});
