import { test, expect } from '@playwright/test';

const retreatId = '507f1f77bcf86cd799439011';

test.describe('Retreat bulk email', () => {
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

  test('opens retreat email dialog and sends to all clients with email addresses', async ({ page }) => {
    let postedBulkEmail: any = null;

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

      if (url.pathname === `/retreats/${retreatId}`) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            _id: retreatId,
            name: 'BEN-10-01-26',
            code: 'BEN-10-01-26',
            location: 'Benecko',
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: '2026-10-08T00:00:00.000Z',
            capacity: 6,
            status: 'upcoming',
          }),
        });
        return;
      }

      if (url.pathname === `/retreats/${retreatId}/hero-image-url`) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ heroImageUrl: null, source: null }) });
        return;
      }

      if (url.pathname === `/bookings/retreat/${retreatId}/with-details`) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              _id: 'booking-1',
              bookingNumber: 1201,
              status: 'confirmed',
              registrationDate: '2026-06-01T00:00:00.000Z',
              totalAmount: 45000,
              currency: 'CZK',
              clientId: {
                _id: 'client-1',
                firstName: 'Anna',
                lastName: 'Nowak',
                email: 'anna@example.com',
                phone: '+48 111 111 111',
                display_id: 1001,
              },
            },
            {
              _id: 'booking-2',
              bookingNumber: 1202,
              status: 'confirmed',
              registrationDate: '2026-06-02T00:00:00.000Z',
              totalAmount: 45000,
              currency: 'CZK',
              clientId: {
                _id: 'client-2',
                firstName: 'Bartek',
                lastName: 'Kowal',
                email: 'bartek@example.com',
                phone: '+48 222 222 222',
                display_id: 1002,
              },
            },
          ]),
        });
        return;
      }

      if (url.pathname === `/communications/retreats/${retreatId}/send` && request.method() === 'POST') {
        postedBulkEmail = request.postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            retreatId,
            batchId: 'bulk-email-batch-1',
            totalBookings: 2,
            sent: 2,
            failed: 0,
            skipped: 0,
            results: [],
          }),
        });
        return;
      }

      if (
        url.pathname === '/communications/templates' ||
        url.pathname.startsWith('/payments') ||
        url.pathname.startsWith('/clients') ||
        url.pathname.startsWith('/houses') ||
        url.pathname.startsWith('/retreat-expenses')
      ) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(url.pathname.includes('summary') ? { totalExpensesUSD: 0 } : []) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto(`/admin/retreats/${retreatId}`);
    await expect(page.getByRole('button', { name: /Email Retreat \(2\)/ })).toBeVisible();

    await page.getByRole('button', { name: /Email Retreat \(2\)/ }).click();
    const dialog = page.getByRole('dialog', { name: /Email Everyone in BEN-10-01-26/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Current eligible recipients:')).toBeVisible();

    await dialog.getByLabel('Subject').fill('Important retreat update');
    await dialog.getByLabel('Message').fill('Please read this update before arrival.');
    await dialog.getByRole('button', { name: 'Send to 2' }).click();

    await expect.poll(() => postedBulkEmail).toMatchObject({
      subject: 'Important retreat update',
      bodyText: 'Please read this update before arrival.',
    });
  });
});
