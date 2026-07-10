import { test, expect } from '@playwright/test';

const clientId = '507f1f77bcf86cd799439012';
const retreatId = '507f1f77bcf86cd799439013';

const client = {
  _id: clientId,
  display_id: 1038,
  firstName: 'Marta',
  lastName: 'Legezinska',
  email: 'marta@example.com',
  phone: '+48 728 919 205',
  country: 'PL',
  status: 'active',
  workflowStatus: 'booked',
  tags: ['medically-approved'],
};

test.describe('Client tags', () => {
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

  test('adds and removes client tags from the client detail view', async ({ page }) => {
    let patchPayload: any = null;

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

      if (url.pathname === `/clients/${clientId}` && request.method() === 'GET') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(client) });
        return;
      }

      if (url.pathname === `/clients/${clientId}` && request.method() === 'PATCH') {
        patchPayload = request.postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ ...client, ...patchPayload }),
        });
        return;
      }

      if (
        url.pathname === `/client-medical/client/${clientId}` ||
        url.pathname === `/bookings/client/${clientId}` ||
        url.pathname === `/notes/client/${clientId}` ||
        (url.pathname === '/payment-requests' && url.searchParams.get('clientId') === clientId) ||
        url.pathname === `/client-requirements/client/${clientId}` ||
        url.pathname === `/reminders/client/${clientId}`
      ) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname === `/retreats/${retreatId}`) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            _id: retreatId,
            name: 'JNO Summer Retreat',
            code: 'JNO-07-25-26',
          }),
        });
        return;
      }

      if (url.pathname === `/clients/${clientId}/profile-picture`) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto(`/admin/clients/${clientId}`);
    await expect(page.getByRole('heading', { name: /Marta Legezinska/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: '🏷️ Client Tags' })).toBeVisible();
    await expect(page.getByText('medically-approved')).toBeVisible();

    await page.getByPlaceholder('Add tag, e.g. medically-approved').fill('Ekg received');
    await page.getByRole('button', { name: 'Add tag' }).click();

    await expect.poll(() => patchPayload?.tags).toEqual(['medically-approved', 'ekg-received']);
    await expect(page.getByText('ekg-received')).toBeVisible();

    await page.getByLabel('Remove tag ekg-received').click();
    await expect.poll(() => patchPayload?.tags).toEqual(['medically-approved']);
  });

  test('filters the client grid by tag', async ({ page }) => {
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

      if (url.pathname === '/clients') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              ...client,
              _id: clientId,
              firstName: 'Marta',
              lastName: 'Legezinska',
              tags: ['medically-approved', 'liver-received'],
            },
            {
              _id: 'client-2',
              display_id: 1041,
              firstName: 'Jacek',
              lastName: 'Jacewicz',
              email: 'jacek@example.com',
              phone: '+48 123 456 789',
              country: 'PL',
              status: 'active',
              workflowStatus: 'potential',
              tags: ['liver-received'],
            },
          ]),
        });
        return;
      }

      if (url.pathname === '/retreats' || url.pathname === '/bookings/retreats' || url.pathname.startsWith('/bookings/')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname.startsWith('/client-medical') || url.pathname.startsWith('/medical-artifacts')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/admin/clients');
    await expect(page.getByRole('heading', { name: 'Clients Management' })).toBeVisible();
    await expect(page.getByText('medically-approved')).toBeVisible();

    await page.locator('select.clients-toolbar-select').nth(1).selectOption('medically-approved');
    await expect(page.getByText('Jacek')).not.toBeVisible();
    await expect(page.getByText('Marta')).toBeVisible();
  });
});
