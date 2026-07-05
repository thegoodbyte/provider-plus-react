import { test, expect } from '@playwright/test';

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'admin',
  firstName: 'Admin',
  lastName: 'User',
};

const retreat = {
  _id: 'retreat-1',
  name: 'JNO Summer Retreat',
  code: 'JNO-07-25-26',
  retreatCode: 'JNO-07-25-26',
  location: 'Benecko',
  location_town: 'Benecko',
  startDate: '2026-07-25T00:00:00.000Z',
  startTime: '12:00',
  endDate: '2026-08-02T00:00:00.000Z',
  endTime: '10:00',
  capacity: 6,
  currentOccupancy: 0,
  status: 'upcoming',
  type: 'regular',
  retreatStaff: [],
};

test.describe('New feature flows', () => {
  test('assigns helper and cook from the Contact Book directory on a retreat', async ({ page }) => {
    let patchPayload: any = null;

    await page.addInitScript((user) => {
      window.localStorage.setItem('token', 'test-token');
      window.localStorage.setItem('user', JSON.stringify(user));
    }, adminUser);

    await page.route('**', async (route) => {
      const request = route.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) {
        await route.continue();
        return;
      }

      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname.endsWith('/retreats/retreat-1') && request.method() === 'PATCH') {
        patchPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...retreat, ...patchPayload }),
        });
        return;
      }

      if (pathname.endsWith('/retreats/retreat-1')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(retreat),
        });
        return;
      }

      if (pathname.endsWith('/retreats/retreat-1/hero-image-url')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ heroImageUrl: null }) });
        return;
      }

      if (pathname.endsWith('/bookings/retreat/retreat-1/with-details')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (pathname.endsWith('/retreat-expenses/retreat/retreat-1/summary')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalExpensesUSD: 0 }) });
        return;
      }

      if (pathname.endsWith('/payments/by-retreat/retreat-1') || pathname.endsWith('/houses')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (pathname.endsWith('/contact-book')) {
        const role = url.searchParams.get('role');
        const helperContact = {
          _id: 'contact-helper-1',
          name: 'Maria Helper',
          role: 'helper',
          phone: '+420 111 222',
          email: 'maria@example.com',
          isActive: true,
        };
        const cookContact = {
          _id: 'contact-cook-1',
          name: 'Pavel Cook',
          role: 'cook',
          phone: '+420 333 444',
          email: 'pavel@example.com',
          isActive: true,
        };

        const contacts = role === 'helper'
          ? [helperContact]
          : role === 'cook'
            ? [cookContact]
            : [helperContact, cookContact];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(contacts),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/admin/retreats/retreat-1');

    await expect(page.getByRole('heading', { name: 'Helper Directory Assignments' })).toBeVisible();
    await page.getByRole('button', { name: /Edit assignments/i }).click();

    await expect(page.getByRole('heading', { name: /Edit Retreat/i })).toBeVisible();
    await page.getByRole('button', { name: /Add person/i }).click();

    await page.getByLabel('Directory person').selectOption('contact-helper-1');
    await page.getByLabel('Planned salary').fill('12500');
    await page.getByLabel('Notes').fill('Full week from ceremony afternoon through discovery morning.');
    await page.getByRole('button', { name: /Update Retreat/i }).click();

    await expect.poll(() => patchPayload?.retreatStaff?.length).toBe(1);
    expect(patchPayload.retreatStaff[0]).toEqual(expect.objectContaining({
      contactId: 'contact-helper-1',
      role: 'helper',
      name: 'Maria Helper',
      phone: '+420 111 222',
      email: 'maria@example.com',
      plannedSalary: 12500,
      salaryCurrency: 'CZK',
      notes: 'Full week from ceremony afternoon through discovery morning.',
    }));
  });

  test('allows real logged-in users to change password and hides it while impersonating', async ({ page }) => {
    let passwordPayload: any = null;

    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'test-token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 'advisor-1',
        email: 'advisor@example.com',
        role: 'medical_advisor',
      }));
    });

    await page.route('**', async (route) => {
      const request = route.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) {
        await route.continue();
        return;
      }

      const url = new URL(request.url());
      if (url.pathname.endsWith('/users/change-password') && request.method() === 'PUT') {
        passwordPayload = request.postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Password changed successfully' }),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/users/change-password');
    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();
    await page.getByLabel('Current Password:').fill('OldPassword123');
    await page.getByRole('textbox', { name: 'New Password:', exact: true }).fill('NewPassword456');
    await page.getByRole('textbox', { name: 'Confirm New Password:', exact: true }).fill('NewPassword456');
    await page.getByRole('main').getByRole('button', { name: 'Change Password' }).click();

    await expect(page.getByText('Password changed successfully')).toBeVisible();
    expect(passwordPayload).toEqual({
      oldPassword: 'OldPassword123',
      newPassword: 'NewPassword456',
    });

    const impersonatedPage = await page.context().newPage();
    await impersonatedPage.addInitScript(() => {
      window.localStorage.setItem('token', 'test-token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 'advisor-1',
        email: 'advisor@example.com',
        role: 'medical_advisor',
        impersonatedBy: 'admin-1',
        originalRole: 'admin',
        impersonationType: 'user_impersonation',
      }));
    });
    await impersonatedPage.route('**', async (route) => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await impersonatedPage.goto('/users/change-password');
    await expect(impersonatedPage.getByRole('heading', { name: 'Change Password' })).not.toBeVisible();
    await impersonatedPage.close();
  });
});
