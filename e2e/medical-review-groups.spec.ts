import { test, expect } from '@playwright/test';

const groupId = '507f1f77bcf86cd799439500';
const pendingRequestId = '507f1f77bcf86cd799439501';
const approvedRequestId = '507f1f77bcf86cd799439502';

const pendingRequest = {
  _id: pendingRequestId,
  display_id: 1012,
  status: 'pending',
  requestType: 'ekg_review',
  documentType: 'EKG',
  documentStage: 'entry',
  clientId: {
    _id: 'client-1',
    firstName: 'Marta',
    lastName: 'Legezinska',
  },
  retreatId: {
    _id: 'retreat-1',
    code: 'JNO-07-25-26',
    retreatCode: 'JNO-07-25-26',
    name: 'JNO-07-25-26',
  },
};

const approvedRequest = {
  _id: approvedRequestId,
  display_id: 1009,
  status: 'approved',
  requestType: 'liver_panel_review',
  documentType: 'Liver',
  documentStage: 'entry',
  clientId: {
    _id: 'client-2',
    firstName: 'Barbara',
    lastName: 'Peicher',
  },
  retreatId: {
    _id: 'retreat-1',
    code: 'JNO-07-25-26',
    retreatCode: 'JNO-07-25-26',
    name: 'JNO-07-25-26',
  },
};

test.describe('Medical review group page', () => {
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

      if (url.pathname === `/medical-review-requests/groups/${groupId}` && request.method() === 'POST') {
        const body = request.postDataJSON();
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            _id: 'link-2',
            label: 'Issued link',
            url: 'https://retreatengine.com/medical-review-group-access/token-2',
            status: 'active',
            expiresAt: '2026-07-24T10:00:00.000Z',
            createdAt: '2026-07-10T10:05:00.000Z',
            expiresInDays: body.expiresInDays,
          }),
        });
        return;
      }

      if (url.pathname === `/medical-review-requests/groups/${groupId}`) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            _id: groupId,
            title: 'JNO-07-25-26',
            groupType: 'retreat',
            retreatName: 'JNO-07-25-26',
            reviewRequestIds: [pendingRequestId, approvedRequestId],
            requests: [pendingRequest, approvedRequest],
          }),
        });
        return;
      }

      if (url.pathname.startsWith(`/medical-review-requests/groups/${groupId}/access-links`) && request.method() !== 'POST') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              _id: 'link-1',
              label: 'Issued link',
              url: 'https://retreatengine.com/medical-review-group-access/token-1',
              status: 'active',
              createdAt: '2026-07-10T10:00:00.000Z',
            },
          ]),
        });
        return;
      }

      if (url.pathname.startsWith('/medical-review-requests')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (url.pathname.startsWith('/users') || url.pathname.startsWith('/retreats') || url.pathname.startsWith('/clients')) {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('shows only pending requests in the packet and issues expiring links', async ({ page }) => {
    let capturedExpiry = 0;

    await page.route('**/medical-review-requests/groups/507f1f77bcf86cd799439500/access-links', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON();
      capturedExpiry = body.expiresInDays;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'link-2',
          label: 'Issued link',
          url: 'https://retreatengine.com/medical-review-group-access/token-2',
          status: 'active',
          expiresAt: '2026-07-24T10:00:00.000Z',
          createdAt: '2026-07-10T10:05:00.000Z',
        }),
      });
    });

    await page.goto(`/medical/review-groups/${groupId}`);

    await expect(page.getByRole('heading', { name: 'JNO-07-25-26' })).toBeVisible();
    await expect(page.getByText('#1012')).toBeVisible();
    await expect(page.getByText('Marta Legezinska')).toBeVisible();
    await expect(page.getByText('#1009')).toBeHidden();

    await page.getByLabel('Add MRR to packet').click();
    await expect(page.getByRole('heading', { name: 'Add MRRs to packet' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).last().click();

    await page.getByLabel('Expire in').fill('14');
    await page.getByRole('button', { name: 'Issue new link' }).click();

    await expect.poll(() => capturedExpiry).toBe(14);
    await expect(page.getByText('expires 7/24/2026')).toBeVisible();

    await page.getByLabel('Edit packet').click();
    await expect(page.getByRole('button', { name: 'Remove from packet' })).toBeVisible();
  });
});
