import { test, expect } from '@playwright/test';

const bookingId = '507f1f77bcf86cd799439011';
const clientId = '507f1f77bcf86cd799439012';
const retreatId = '507f1f77bcf86cd799439013';

test.describe('Booking confirmation history', () => {
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

  test('shows confirmation iterations and captures update reason before quick send', async ({ page }) => {
    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.origin === new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin) {
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
            bookingConfirmationHistory: [
              {
                _id: 'history-1',
                iteration: 1,
                action: 'created',
                reason: 'Original booking confirmation',
                language: 'pl',
                sentAt: '2026-06-24T10:00:00.000Z',
                sentEmailDisplayId: 1001,
                snapshot: {
                  retreatCode: 'BEN-09-22-26',
                  paymentRequestDisplayId: 1179,
                },
              },
              {
                _id: 'history-2',
                iteration: 2,
                action: 'updated',
                reason: 'Date change',
                language: 'pl',
                sentAt: '2026-06-25T12:30:00.000Z',
                sentEmailDisplayId: 1008,
                snapshot: {
                  retreatCode: 'BEN-10-01-26',
                  paymentRequestDisplayId: 1181,
                },
              },
            ],
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
              name: 'BEN-10-01-26',
              code: 'BEN-10-01-26',
              location_town: 'Benecko',
              startDate: '2026-10-01T00:00:00.000Z',
              endDate: '2026-10-08T00:00:00.000Z',
            },
          }),
        });
        return;
      }

      if (url.pathname === `/bookings/${bookingId}/activity`) {
        return route.fulfill({json: [
          {id:'history-1',type:'email',title:'Booking confirmation · Iteration 1',description:'Original booking confirmation · Email #1001 · BEN-09-22-26 · Payment request #1179',occurredAt:'2026-06-24T10:00:00Z'},
          {id:'history-2',type:'email',title:'Booking confirmation · Iteration 2',description:'Date change · Email #1008 · BEN-10-01-26 · Payment request #1181',occurredAt:'2026-06-25T12:30:00Z'},
        ]});
      }
      if (url.pathname.startsWith('/booking-flow/') || url.pathname === '/booking-flow/items') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (
        url.pathname.startsWith('/medical-artifacts') ||
        url.pathname.startsWith('/medical-review-requests') ||
        url.pathname.startsWith('/ceremonies') ||
        url.pathname.startsWith('/tasks') ||
        url.pathname.startsWith('/payments') ||
        url.pathname.startsWith('/houses') ||
        url.pathname.startsWith('/communications')
      ) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(page.getByRole('heading', { name: /Booking #1247/i })).toBeVisible();

    await page.getByRole('tab', {name:'Activity',exact:true}).click();
    const historySection=page.getByRole('region',{name:'Booking activity timeline'});
    await expect(historySection.getByText('Booking confirmation · Iteration 1',{exact:true})).toBeVisible();
    await expect(historySection.getByText('Booking confirmation · Iteration 2',{exact:true})).toBeVisible();
    await expect(historySection).toContainText('Original booking confirmation');
    await expect(historySection).toContainText('Date change · Email #1008 · BEN-10-01-26 · Payment request #1181');

    await page.locator('summary').filter({hasText:/^More$/}).click();
    await page.getByRole('button', { name: 'Send email with PDF attachment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Send booking confirmation?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Reason')).toHaveValue('Updated booking confirmation');
    await dialog.getByLabel('Reason').fill('New payment received');
    await expect(dialog.getByLabel('Reason')).toHaveValue('New payment received');
  });
});
