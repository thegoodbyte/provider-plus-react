import { expect, test } from '@playwright/test';

test.describe('PPVC-777 & PPVC-781 Referral Holistic Assignment View', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }));
    });
  });

  test('views all retreats, filters by retreat, verifies booking date, and batch updates referrals', async ({ page }) => {
    const partner1 = { _id: 'partner-1', name: 'Alchemia Dobrostanu', referralCode: 'AD', defaultCommissionPercentage: 10, isActive: true };
    const partner2 = { _id: 'partner-2', name: 'Bwiti Friends', referralCode: 'BF', defaultCommissionPercentage: 15, isActive: true };

    const pastRetreat = {
      _id: 'ret-past',
      name: 'Spring Bwiti Retreat',
      code: 'SBR-2026',
      startDate: '2026-04-10',
      endDate: '2026-04-17',
      location: 'Jablonné nad Orlicí',
      status: 'active',
      backgroundColor: '#87bdf0',
    };

    const futureRetreat = {
      _id: 'ret-future',
      name: 'Autumn Iboga Retreat',
      code: 'AIR-2026',
      startDate: '2026-11-13',
      endDate: '2026-11-20',
      location: 'Jablonné nad Orlicí',
      status: 'active',
      backgroundColor: '#f4b285',
    };

    const bookings = [
      {
        _id: 'b-past-1',
        retreatId: pastRetreat._id,
        bookingNumber: 1105,
        totalAmount: 2000,
        currency: 'EUR',
        firstPaymentDate: '2026-03-01T12:00:00.000Z',
        referralPartnerId: partner1._id,
        referralAttribution: 'direct',
        status: 'confirmed',
        clientId: {
          _id: 'c-1',
          firstName: 'Dana',
          lastName: 'Babicova',
          display_id: 1201,
          phone: '+420 777 123 456',
        },
      },
      {
        _id: 'b-future-1',
        retreatId: futureRetreat._id,
        bookingNumber: 1264,
        totalAmount: 2500,
        currency: 'EUR',
        firstPaymentDate: '2026-09-15T10:00:00.000Z',
        status: 'confirmed',
        clientId: {
          _id: 'c-2',
          firstName: 'Jan',
          lastName: 'Kowalski',
          display_id: 1260,
          phone: '+48 600 111 222',
        },
      },
    ];

    let batchUpdates: any = null;

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.port === '3000') return route.continue();
      if (url.pathname === '/environment/status') return route.fulfill({ json: { environment: 'local', production: false, enabledJobs: [] } });
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === '/retreats' && request.method() === 'GET') {
        return route.fulfill({ json: [pastRetreat, futureRetreat] });
      }
      if (url.pathname === '/referrals' && request.method() === 'GET') {
        return route.fulfill({ json: [partner1, partner2] });
      }
      if (url.pathname === '/bookings' && request.method() === 'GET') {
        return route.fulfill({ json: bookings });
      }
      if (url.pathname === '/houses' && request.method() === 'GET') {
        return route.fulfill({ json: [] });
      }
      if (url.pathname === '/bookings/batch-referral-attribution' && request.method() === 'PATCH') {
        batchUpdates = request.postDataJSON();
        return route.fulfill({ json: { updatedCount: batchUpdates?.updates?.length || 1 } });
      }
      return route.fulfill({ json: [] });
    });

    page.on('pageerror', error => console.log('Browser error:', error.message));
    // 1. Navigate to holistic referrals view
    await page.goto('/admin/retreats?view=referrals');

    // 2. Verify all retreats (past and future) are rendered
    await expect(page.getByRole('heading', { name: 'Holistic Booking Referral Assignment' })).toBeVisible();
    await expect(page.getByText('SBR-2026', { exact: true })).toBeVisible();
    await expect(page.getByText('AIR-2026', { exact: true })).toBeVisible();

    // 3. Verify client names and "Booking date" displays
    await expect(page.getByText('Dana Babicova')).toBeVisible();
    await expect(page.getByText('Jan Kowalski')).toBeVisible();
    await expect(page.getByText('Booking date:').first()).toBeVisible();

    // 4. Test Retreat filter dropdown
    const retreatFilter = page.getByLabel('Filter by Retreat');
    await retreatFilter.selectOption(futureRetreat._id);

    // Only future retreat is visible; past retreat is filtered out
    await expect(page.getByText('AIR-2026', { exact: true })).toBeVisible();
    await expect(page.getByText('SBR-2026', { exact: true })).not.toBeVisible();

    // Reset retreat filter to All Retreats
    await retreatFilter.selectOption('');
    await expect(page.getByText('SBR-2026', { exact: true })).toBeVisible();
    await expect(page.getByText('AIR-2026', { exact: true })).toBeVisible();

    // 5. Test Partner filter dropdown
    const partnerFilter = page.getByLabel('Filter by Referral Partner');
    await partnerFilter.selectOption(partner1._id);
    await expect(page.getByRole('heading', { name: 'Referrals for Alchemia Dobrostanu' })).toBeVisible();

    // Reset partner filter
    await partnerFilter.selectOption('');

    // 6. Enter edit mode, modify attribution, and save via floating action bar
    await page.getByRole('button', { name: 'Edit Referrals' }).click();
    await expect(page.getByText(/Edit Mode Active/i)).toBeVisible();
    await expect(page.getByLabel('Floating Action Bar')).toBeVisible();

    // Assign Jan Kowalski to Bwiti Friends (partner2) with Self-Identified attribution
    const partnerSelect = page.getByLabel(/Referral partner for Jan Kowalski/i);
    await partnerSelect.selectOption(partner2._id);

    const attributionSelect = page.getByLabel(/Attribution type for Jan Kowalski/i);
    await attributionSelect.selectOption('self_identified');

    // Click Save Changes in floating bar
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify batch update request payload
    await expect.poll(() => batchUpdates).toMatchObject({
      updates: expect.arrayContaining([
        expect.objectContaining({
          bookingId: 'b-future-1',
          referralPartnerId: partner2._id,
          referralAttribution: 'self_identified',
        }),
      ]),
    });
  });
});
