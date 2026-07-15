import { test, expect } from '@playwright/test';

const bookingId = '507f1f77bcf86cd799439611';
const clientId = '507f1f77bcf86cd799439612';
const retreatId = '507f1f77bcf86cd799439613';
const artifactId = '507f1f77bcf86cd799439614';

test.describe('Booking medical fallback', () => {
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

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.port === '3001' && !['xhr', 'fetch'].includes(request.resourceType())) {
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
            bookingNumber: 1248,
            status: 'confirmed',
            clientId: {
              _id: clientId,
              display_id: 1107,
              firstName: 'Jacek',
              lastName: 'Jacewicz',
              email: 'jacek@example.com',
            },
            retreatId: {
              _id: retreatId,
              code: 'JNO-07-25-26',
              name: 'JNO-07-25-26',
              location_town: 'Benecko',
            },
          }),
        });
        return;
      }

      if (url.pathname === '/booking-flow/items' && url.searchParams.get('bookingId') === bookingId) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname === '/medical-artifacts') {
        const bookingFlowItemId = url.searchParams.get('bookingFlowItemId');
        const bookingFlowItemKey = url.searchParams.get('bookingFlowItemKey');
        const bookingParam = url.searchParams.get('bookingId');
        if (bookingFlowItemId || bookingFlowItemKey) {
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
          return;
        }
        if (bookingParam === bookingId) {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify([
              {
                _id: artifactId,
                display_id: 1019,
                artifactType: 'liver_panel',
                documentType: 'Liver',
                documentStage: 'entry',
                title: 'Entry liver panel',
                description: 'Uploaded liver document',
                bookingId,
                clientId,
                retreatId,
                receivedAt: '2026-07-10T08:00:00.000Z',
                files: [
                  {
                    fileName: 'liver.pdf',
                    s3Key: 'medical-artifacts/liver_panel/artifact-1/liver.pdf',
                    mimeType: 'application/pdf',
                    size: 102400,
                    uploadedAt: '2026-07-10T08:00:00.000Z',
                  },
                ],
              },
            ]),
          });
          return;
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname === '/medical-review-requests/by-artifacts') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname.startsWith('/medical-review-requests') || url.pathname.startsWith('/ceremonies') || url.pathname.startsWith('/tasks') || url.pathname.startsWith('/communications') || url.pathname.startsWith('/payments') || url.pathname.startsWith('/booking-documents')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('shows the booking-level liver artifact in the Medical tab', async ({ page }) => {
    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(page.getByRole('heading', { name: /Booking #1248/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Medical' }).click();

    await expect(page.getByText('Entry Liver', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Artifact #1019' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '#1019 Entry liver panel' })).toBeVisible();
  });
});
