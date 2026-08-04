import { expect, test } from '@playwright/test';

const authState = () => {
  window.localStorage.setItem('token', 'e2e-token');
  window.localStorage.setItem('user', JSON.stringify({
    id: 'admin-e2e',
    email: 'admin@example.com',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User',
  }));
};

test.describe('Recent PPVC ticket regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(authState);
  });

  test('PPVC-295 shows Send questionnaire and no upload action on Questionnaire sent', async ({ page }) => {
    const retreatId = '507f1f77bcf86cd799439701';
    const bookingId = '507f1f77bcf86cd799439702';
    const clientId = '507f1f77bcf86cd799439703';
    const itemId = '507f1f77bcf86cd799439704';
    const booking = {
      _id: bookingId,
      bookingNumber: 1301,
      status: 'confirmed',
      retreatId,
      clientId: {
        _id: clientId,
        firstName: 'Anna',
        lastName: 'Novak',
        email: 'anna@example.com',
        display_id: 1201,
      },
    };
    const questionnaireItem = {
      _id: itemId,
      bookingId: booking,
      clientId: booking.clientId,
      retreatId,
      key: 'questionnaire_sent',
      title: 'Questionnaire sent',
      category: 'questionnaire',
      status: 'pending',
      order: 140,
      metadata: { expectedArtifact: 'questionnaire' },
      actions: [{
        key: 'send_questionnaire',
        label: 'Send questionnaire',
        type: 'email',
        emailTemplateId: 'template-questionnaire',
        statusAfterSuccess: 'sent',
        allowRepeat: true,
      }],
    };

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.port === '3000') return route.continue();
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === `/retreats/${retreatId}`) return route.fulfill({ json: {
        _id: retreatId,
        name: 'Benešov retreat',
        code: 'BEN-09-01-26',
        startDate: '2026-09-01',
        endDate: '2026-09-08',
        status: 'upcoming',
      } });
      if (url.pathname === `/retreats/${retreatId}/hero-image-url`) return route.fulfill({ json: { heroImageUrl: null } });
      if (url.pathname === `/bookings/retreat/${retreatId}/with-details`) return route.fulfill({ json: [booking] });
      if (url.pathname === `/booking-flow/matrix/${retreatId}`) return route.fulfill({ json: {
        bookings: [booking],
        templates: [],
        items: [questionnaireItem],
        actionLogs: [],
      } });
      if (url.pathname === '/booking-flow/library/templates') return route.fulfill({ json: [] });
      return route.fulfill({ json: [] });
    });

    await page.goto(`/admin/retreats/${retreatId}/holisticView`);

    const questionnaireCell = page.locator('td').filter({ has: page.getByRole('button', { name: 'Send questionnaire' }) });
    await expect(questionnaireCell).toBeVisible();
    await expect(questionnaireCell.getByRole('button', { name: 'Send questionnaire' })).toBeVisible();
    await expect(questionnaireCell.getByText(/Upload Questionnaire/i)).toHaveCount(0);
    await expect(questionnaireCell.locator('input[type="file"]')).toHaveCount(0);
  });

  test('PPVC-383 reveals, saves, and restores Opioids and Other drugs details', async ({ page }) => {
    const clientId = '507f1f77bcf86cd799439711';
    let savedScreening: Record<string, any> = {};

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.port === '3000') return route.continue();
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === '/referrals') return route.fulfill({ json: [] });
      if (url.pathname === `/clients/${clientId}` && request.method() === 'GET') return route.fulfill({ json: {
        _id: clientId,
        display_id: 1211,
        firstName: 'Petra',
        lastName: 'Svobodova',
        email: 'petra@example.com',
        phone: '+420123456789',
        screeningData: savedScreening,
      } });
      if (url.pathname === `/clients/${clientId}/screening` && request.method() === 'PUT') {
        savedScreening = request.postDataJSON();
        return route.fulfill({ json: {
          _id: clientId,
          firstName: 'Petra',
          lastName: 'Svobodova',
          screeningData: savedScreening,
        } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto(`/admin/clients/${clientId}/screening`);
    await expect(page.getByRole('heading', { name: 'Client Screening Form' })).toBeVisible();

    const opioids = page.getByRole('checkbox', { name: 'Opioids' });
    const otherDrugs = page.getByRole('checkbox', { name: 'Other drugs' });
    await expect(page.locator('textarea[name="opioidsDetails"]')).toHaveCount(0);
    await expect(page.locator('textarea[name="otherDrugsDetails"]')).toHaveCount(0);

    await opioids.check();
    await otherDrugs.check();
    await page.locator('textarea[name="opioidsDetails"]').fill('Prescription oxycodone, last used January 2026');
    await page.locator('textarea[name="otherDrugsDetails"]').fill('Occasional kratom use');
    await page.getByRole('button', { name: 'Save Screening' }).first().click();

    await expect.poll(() => savedScreening.opioids).toBe(true);
    expect(savedScreening).toMatchObject({
      opioids: true,
      opioidsDetails: 'Prescription oxycodone, last used January 2026',
      otherDrugs: true,
      otherDrugsDetails: 'Occasional kratom use',
    });

    await page.goto(`/admin/clients/${clientId}/screening`);
    await expect(opioids).toBeChecked();
    await expect(otherDrugs).toBeChecked();
    await expect(page.locator('textarea[name="opioidsDetails"]')).toHaveValue('Prescription oxycodone, last used January 2026');
    await expect(page.locator('textarea[name="otherDrugsDetails"]')).toHaveValue('Occasional kratom use');
  });
});
