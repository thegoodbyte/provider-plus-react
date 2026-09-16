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

  for (const useRecipientLanguage of [true, false]) test(`retreat email recipient language ${useRecipientLanguage ? 'enabled by default' : 'can be overridden'}`, async ({ page }) => {
    let postedBulkEmail: any = null;

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (!['xhr', 'fetch'].includes(request.resourceType())) {
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
                language: 'pl',
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
                language: 'cs',
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

      if (url.pathname === '/communications/templates') {
        return route.fulfill({ json: [{ _id: 'template-pl', name: 'Arrival address Polish', templateKey: 'arrival_address', language: 'pl', active: true, subject: 'Adres', bodyText: 'Polish arrival instructions' }] });
      }
      if (url.pathname === '/communications/preview') {
        return route.fulfill({ json: { subject: 'Adres', bodyText: 'Polish arrival instructions', bodyHtml: '' } });
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
    await expect(page.getByRole('button', { name: /Email retreat clients \(2\)/ })).toBeVisible();

    await page.getByRole('button', { name: /Email retreat clients \(2\)/ }).click();
    const dialog = page.getByRole('dialog', { name: /Email retreat clients.*BEN-10-01-26/ });
    await expect(dialog).toBeVisible();
    const languageCheckbox = dialog.getByRole('checkbox', { name: 'Use each recipient’s preferred language' });
    await expect(languageCheckbox).toBeChecked();
    await languageCheckbox.uncheck();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: /Email retreat clients \(2\)/ }).click();
    await expect(languageCheckbox).toBeChecked();
    if (useRecipientLanguage) {
      await dialog.getByLabel('Template', { exact: true }).click();
      await page.getByText('Arrival address Polish · PL', { exact: true }).click();
      await expect(dialog.getByLabel('Subject')).toHaveValue('Adres');
      await expect(dialog.getByLabel('Message')).toHaveValue('Polish arrival instructions');
      await expect(dialog.getByLabel('Message')).toHaveAttribute('readonly', '');
    } else {
      await languageCheckbox.uncheck();
      await expect(dialog.getByLabel('Message')).not.toHaveAttribute('readonly', '');
    }

    if (!useRecipientLanguage) {
      await dialog.getByLabel('Subject').fill('Important retreat update');
      await dialog.getByLabel('Message').fill('Please read this update before arrival.');
    }
    await dialog.getByRole('button', { name: 'Send to 2' }).click();

    await expect.poll(() => postedBulkEmail).toMatchObject({
      useRecipientLanguage,
      subject: useRecipientLanguage ? 'Adres' : 'Important retreat update',
      bodyText: useRecipientLanguage ? 'Polish arrival instructions' : 'Please read this update before arrival.',
    });
  });
});
