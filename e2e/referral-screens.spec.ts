import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`separate referral screens, direct links and CRUD at ${viewport.width}px`, async ({ page }) => {
    let partners: any[] = [
      { _id: 'r1', name: 'Alchemia Dobrostanu', referralCode: 'AD', email: 'partner@example.invalid', defaultCommissionPercentage: 10, isActive: true, commissionPackages: [{ key: 'summer', name: 'Summer partnership', effectiveFrom: '2026-06-01', bookingCurrency: 'EUR', kind: 'percentage', ratePercent: 15 }] },
      { _id: 'r2', name: 'Bwiti Friends', referralCode: 'BF', defaultCommissionPercentage: 8, isActive: false },
    ];
    let failSave = false;
    const report = [{ bookingId: 'b1', bookingNumber: 101, clientId: 'c1', clientName: 'Example Guest', referralId: 'r1', referralName: partners[0].name, referralCode: 'AD', retreatId: 't1', retreatCode: 'Summer 2026', registrationDate: '2026-06-15', commissionPercentage: 15, commissionKind: 'percentage', packageName: 'Summer partnership', amountOwed: 150, owedCurrency: 'EUR', paid: false }];
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.invalid', role: 'admin' }));
    });
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin === 'http://localhost:3000') return route.continue();
      const json = (value: any, status = 200) => route.fulfill({ status, json: value, headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true' } });
      if (url.pathname === '/environment/status') return json({ environment: 'development', production: false, enabledJobs: [] });
      if (url.pathname === '/referrals' && request.method() === 'GET') return json(partners);
      if (url.pathname === '/referrals/report') return json(report);
      if (url.pathname === '/referrals/payouts') return json([]);
      if (url.pathname.endsWith('/portal-account')) return json(null);
      if (url.pathname === '/referrals' && request.method() === 'POST') {
        const partner = { ...request.postDataJSON(), _id: 'r3' }; partners = [...partners, partner]; return json(partner, 201);
      }
      const partner = partners.find(item => url.pathname === `/referrals/${item._id}`);
      if (partner && request.method() === 'PATCH') {
        if (failSave) return json({ message: 'Temporary save failure. Please retry.' }, 503);
        Object.assign(partner, request.postDataJSON()); return json(partner);
      }
      if (partner && request.method() === 'DELETE') { partners = partners.filter(item => item !== partner); return json(partner); }
      if (url.pathname === '/') return json({ ok: true });
      return json([]);
    });
    page.on('pageerror', error => console.error('Browser error:', error.message));
    const output = path.resolve(__dirname, '../../ppvc-806-validation/navigation'); fs.mkdirSync(output, { recursive: true });
    await page.goto('/admin/referrals');
    await expect(page.getByRole('heading', { name: 'Referral partners' })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.screenshot({ path: path.join(output, `directory-${viewport.width}.png`) });
    await page.getByLabel('Partner status').selectOption('inactive');
    await expect(page.getByRole('link', { name: 'Alchemia Dobrostanu', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Bwiti Friends', exact: true })).toBeVisible();
    await page.getByLabel('Partner status').selectOption('all');
    await page.getByLabel('Search partners').fill('AD');
    await page.getByRole('link', { name: 'Alchemia Dobrostanu', exact: true }).click();
    await expect(page).toHaveURL(/\/referrals\/r1$/);
    await expect(page.getByRole('region', { name: 'Partner overview' })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.screenshot({ path: path.join(output, `partner-${viewport.width}.png`) });
    await page.getByRole('link', { name: 'View commissions', exact: true }).click();
    await expect(page).toHaveURL(/\/referrals\/commissions\?referralId=r1$/);
    await expect(page.getByLabel('Filter by referral')).toHaveValue('r1');
    await expect(page.getByText('Summer partnership', { exact: true })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Filter by referral')).toHaveValue('r1');
    await page.screenshot({ path: path.join(output, `commissions-${viewport.width}.png`) });
    await page.goBack();
    await page.getByRole('link', { name: 'Manage portal access' }).click();
    await expect(page).toHaveURL(/\/referrals\/r1\/access$/);
    await expect(page.getByRole('heading', { name: 'Referral portal access' })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Referral settings' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to partner' }).click();
    await page.getByRole('link', { name: 'Edit Alchemia Dobrostanu' }).click();
    await expect(page).toHaveURL(/\/referrals\/r1\/edit$/);
    await expect(page.getByLabel('Partner name')).toHaveValue('Alchemia Dobrostanu');
    await expect(page.getByRole('heading', { name: 'Referral portal access' })).toHaveCount(0);
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.getByLabel('Contact phone').fill('+420 777 123 456');
    failSave = true;
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Could not save referral. The service is temporarily unavailable.' })).toBeVisible();
    await expect(page.getByLabel('Contact phone')).toHaveValue('+420 777 123 456');
    failSave = false;
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('Referral saved.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Contact phone')).toHaveValue('+420 777 123 456');
    await page.getByRole('button', { name: 'Back to partner', exact: false }).click();
    await page.getByRole('link', { name: 'View payment history' }).click();
    await expect(page).toHaveURL(/\/referrals\/payments\?referralId=r1$/);
    await expect(page.getByRole('heading', { name: 'Referral payment history' })).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
    await page.getByRole('link', { name: 'Partners', exact: true }).click();
    await page.getByRole('link', { name: 'Add partner', exact: true }).click();
    await expect(page).toHaveURL(/\/referrals\/new$/);
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.getByLabel('Partner name').fill('New partner');
    await page.getByLabel('Referral code', { exact: true }).fill('NP');
    await page.getByRole('button', { name: 'Add referral', exact: true }).click();
    await expect(page).toHaveURL(/\/referrals\/r3\/edit$/);
    await expect(page.getByText('Referral saved.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to partner', exact: false }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete New partner' }).click();
    await expect(page).toHaveURL(/\/referrals$/);
    await expect(page.getByRole('link', { name: 'New partner', exact: true })).toHaveCount(0);
    await page.goto('/admin/referrals?referralId=r1');
    await expect(page).toHaveURL(/\/referrals\/commissions\?referralId=r1$/);
    await expect(page.getByLabel('Filter by referral')).toHaveValue('r1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.goto('/admin/referrals/unknown/edit');
    await expect(page.getByText('This referral partner could not be found.')).toBeVisible();
    await expect(page.getByRole('form')).toHaveCount(0);
  });
}
