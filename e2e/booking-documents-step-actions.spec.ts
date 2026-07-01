import { test, expect } from '@playwright/test';

const bookingId = '507f1f77bcf86cd799439011';
const clientId = '507f1f77bcf86cd799439012';
const retreatId = '507f1f77bcf86cd799439013';
const contractSentStepId = '507f1f77bcf86cd799439021';
const contractReceivedStepId = '507f1f77bcf86cd799439022';

test.describe('Booking document step actions', () => {
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

  test('shows configured document steps, action history, and sends request email', async ({ page }) => {
    let sentRequest = false;

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

      if (url.pathname === '/booking-flow/items' && url.searchParams.get('bookingId') === bookingId) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              _id: contractSentStepId,
              key: 'contract_sent',
              title: 'Contract sent',
              status: 'pending',
              category: 'contract',
              offsetDays: 1,
              bookingId,
              clientId,
              retreatId,
              emailEnabled: true,
              emailTemplateId: 'template-contract',
              metadata: {
                expectedArtifact: 'contract',
              },
            },
            {
              _id: contractReceivedStepId,
              key: 'contract_signed',
              title: 'Contract received',
              status: 'pending',
              category: 'contract',
              offsetDays: 5,
              bookingId,
              clientId,
              retreatId,
              metadata: {
                expectedArtifact: 'contract',
              },
            },
          ]),
        });
        return;
      }

      if (url.pathname === `/booking-flow/items/${contractSentStepId}/action-logs`) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              _id: 'log-email-1',
              bookingFlowItemId: contractSentStepId,
              bookingId,
              clientId,
              retreatId,
              actionType: 'email_sent',
              actionLabel: 'Contract sent',
              statusAfter: 'sent',
              performedAt: '2026-07-01T08:00:00.000Z',
              metadata: { sentEmailDisplayId: 2101 },
            },
          ]),
        });
        return;
      }

      if (url.pathname === `/booking-flow/items/${contractReceivedStepId}/action-logs`) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              _id: 'log-upload-1',
              bookingFlowItemId: contractReceivedStepId,
              bookingId,
              clientId,
              retreatId,
              actionType: 'artifact_received',
              actionLabel: 'Contract received',
              statusAfter: 'received',
              performedAt: '2026-07-01T08:05:00.000Z',
              notes: 'Contract uploaded from booking documents.',
            },
          ]),
        });
        return;
      }

      if (url.pathname === `/booking-flow/items/${contractSentStepId}/send-email` && request.method() === 'POST') {
        sentRequest = true;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            item: { _id: contractSentStepId, status: 'sent' },
            sentEmail: { _id: 'sent-email-1', display_id: 2202, status: 'sent' },
          }),
        });
        return;
      }

      if (url.pathname.startsWith('/medical-artifacts')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (
        url.pathname.startsWith('/medical-review-requests') ||
        url.pathname.startsWith('/ceremonies') ||
        url.pathname.startsWith('/tasks') ||
        url.pathname.startsWith('/payments') ||
        url.pathname.startsWith('/communications')
      ) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(page.getByRole('heading', { name: /Booking #1247/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByText('Email step: Contract sent (pending)')).toBeVisible();
    await expect(page.getByText('Upload step: Contract received (pending)')).toBeVisible();
    await expect(page.getByText('Mark "Contract received" received after upload')).toBeVisible();
    await expect(page.getByText(/email #2101/)).toBeVisible();
    await expect(page.getByText(/Contract uploaded from booking documents/)).toBeVisible();

    await page.getByRole('button', { name: /Send Contract Request/ }).click();
    await expect.poll(() => sentRequest).toBe(true);
  });
});
