import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Opt in explicitly: this suite uses the isolated local API/MongoDB, never production.
test.skip(process.env.PPVC787_LOCAL_E2E !== '1', 'Requires the isolated --pending-release local stack');
test.describe.configure({ mode: 'serial' });
const workspace = path.resolve(__dirname, '../../..');
const apiUrl = 'http://localhost:3005';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`saves, reloads and applies rates/packages, validates and retries at ${viewport.width}px`, async ({ page, request, baseURL }) => {
    test.setTimeout(90000);
    const mongoose = require(path.join(workspace, 'release-20261013-late/api/node_modules/mongoose'));
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const credentials = JSON.parse(fs.readFileSync(path.join(workspace, 'ppvc-660-db-refresh/db-refresh-private/local-credentials.json'), 'utf8'));
    const uri = new URL(credentials.appUri);
    expect(uri.hostname).toBe('127.0.0.1'); expect(uri.port).toBe('27073'); expect(uri.pathname).toBe('/re_local');
    const login = await request.post(apiUrl + '/auth/login', { data: JSON.parse(fs.readFileSync(path.join(workspace, 'ppvc-660-db-refresh/db-refresh-private/local-admin-login.json'), 'utf8')) });
    expect(login.ok()).toBeTruthy();
    const session = await login.json();
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const existing = await (await request.get(apiUrl + '/referrals', { headers })).json();
    const used = new Set(existing.map((item: any) => item.referralCode));
    const codes = [...'ZYXWVUTSRQPONMLKJIHGFEDCBA'].flatMap(a => [...'ZYXWVUTSRQPONMLKJIHGFEDCBA'].map(b => a + b));
    const code = codes.find(code => !used.has(code));
    expect(code).toBeTruthy();
    const name = `Commission E2E ${randomUUID().slice(0, 8)}`;
    let referralId: string | undefined;
    let connection: any;
    const ids = Object.fromEntries(['client', 'retreat', 'booking'].map(key => [key, new mongoose.Types.ObjectId()]));
    try {
      const created = await request.post(apiUrl + '/referrals', { headers, data: { name, referralCode: code, defaultCommissionPercentage: 5 } });
      expect(created.ok()).toBeTruthy(); referralId = (await created.json())._id;
      connection = await mongoose.createConnection(credentials.appUri).asPromise();
      const db = connection.db;
      await db.collection('clients').insertOne({ _id: ids.client, firstName: 'Commission', lastName: name, referralId: new mongoose.Types.ObjectId(referralId) });
      await db.collection('retreats').insertOne({ _id: ids.retreat, name: 'Synthetic commission retreat', code: 'E2E787', startDate: new Date('2026-08-01') });
      await db.collection('retreatclients').insertOne({ _id: ids.booking, clientId: ids.client, retreatId: ids.retreat, referralPartnerId: new mongoose.Types.ObjectId(referralId), referralAttribution: 'direct', registrationDate: new Date('2026-07-15'), totalAmount: 1000, currency: 'EUR', status: 'confirmed', bookingNumber: 999787 });
      await page.setViewportSize(viewport);
      await page.addInitScript(({ token, user }) => {
        localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
      }, { token: session.access_token, user: session.user });
      await page.route('**/*', route => {
        const host = new URL(route.request().url()).hostname;
        return /^(localhost|127\.0\.0\.1)$/.test(host) ? route.continue() : route.abort();
      });
      await page.goto('/admin/referrals');
      await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
      const rates = page.getByRole('region', { name: 'Rate schedule', exact: true });
      const packages = page.getByRole('region', { name: 'Commission packages', exact: true });
      await expect(packages.getByRole('button', { name: 'Save commission packages' })).toBeVisible();
      await expect(rates.getByRole('button', { name: 'Save rate schedule' })).toBeVisible();
      await rates.getByRole('button', { name: '+ Add rate rule', exact: true }).click();
      await rates.getByLabel('From', { exact: true }).fill('2026-01-01');
      await rates.getByLabel('Rate %', { exact: true }).fill('12');
      await rates.getByRole('button', { name: 'Save rate schedule' }).click();
      await expect(page.getByText('Referral saved. Rate schedule and commission packages are saved together.', { exact: true })).toBeVisible();
      let stored = await db.collection('referrals').findOne({ _id: new mongoose.Types.ObjectId(referralId) });
      expect(stored.rateSchedule[0].tiers[0].ratePercent).toBe(12);
      const report = async () => (await (await request.get(apiUrl + '/referrals/report', { headers })).json()).find((row: any) => row.bookingId === String(ids.booking));
      expect((await report()).commissionPercentage).toBe(12);
      await page.reload();
      await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
      await expect(rates.getByLabel('Rate %', { exact: true })).toHaveValue('12');
      await packages.getByRole('button', { name: 'Add commission package' }).click();
      // Native validation must identify missing required fields instead of appearing to save.
      await packages.getByRole('button', { name: 'Save commission packages' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Complete the required fields' })).toBeVisible();
      await packages.getByLabel('Key', { exact: true }).fill('summer');
      await packages.getByLabel('Name', { exact: true }).fill('Summer 20%');
      await packages.getByLabel('From', { exact: true }).fill('2026-06-01');
      await packages.getByLabel('Through (inclusive)').fill('2026-08-31');
      await packages.getByLabel('Booking currency').selectOption('EUR');
      await packages.getByLabel('Rate %', { exact: true }).fill('20');
      // A rejected save keeps values available for retry.
      await page.route(`**/referrals/${referralId}`, route => route.request().method() === 'PATCH'
        ? route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': baseURL!, 'Access-Control-Allow-Credentials': 'true' }, json: { message: 'Synthetic save failure. Please retry.' } }) : route.continue());
      await packages.getByRole('button', { name: 'Save commission packages' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Synthetic save failure' })).toBeVisible();
      await expect(packages.getByLabel('Name', { exact: true })).toHaveValue('Summer 20%');
      await page.unroute(`**/referrals/${referralId}`);
      await packages.getByRole('button', { name: 'Save commission packages' }).click();
      await expect(page.getByText('Referral saved. Rate schedule and commission packages are saved together.', { exact: true })).toBeVisible();
      stored = await db.collection('referrals').findOne({ _id: new mongoose.Types.ObjectId(referralId) });
      expect(stored.commissionPackages[0].ratePercent).toBe(20); expect(stored.rateSchedule[0].tiers[0].ratePercent).toBe(12);
      expect(await report()).toMatchObject({ commissionPercentage: 20, packageName: 'Summer 20%', amountOwed: 200 });
      const output = path.join(workspace, 'ppvc-787-validation'); fs.mkdirSync(output, { recursive: true });
      await packages.getByRole('button', { name: 'Save commission packages' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `settings-packages-${viewport.width}.png`) });
      await rates.getByRole('button', { name: 'Save rate schedule' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `settings-rates-${viewport.width}.png`) });
      await page.reload();
      await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
      await expect(packages.getByLabel('Name', { exact: true })).toHaveValue('Summer 20%');
      await expect(rates).toContainText('this rate schedule is saved but does not apply');
      // Fixed packages use their payout amount/currency instead of the percentage.
      await packages.getByLabel('Calculation').selectOption('fixed');
      await packages.getByLabel('Amount', { exact: true }).fill('75');
      await packages.getByLabel('Payout currency').selectOption('USD');
      await packages.getByRole('button', { name: 'Save commission packages' }).click();
      await expect(page.getByText('Referral saved. Rate schedule and commission packages are saved together.', { exact: true })).toBeVisible();
      expect(await report()).toMatchObject({ commissionKind: 'fixed', amountOwed: 75, owedCurrency: 'USD' });
      await packages.getByRole('button', { name: 'Remove package' }).click();
      await packages.getByRole('button', { name: 'Save commission packages' }).click();
      await expect(page.getByText('Referral saved. Rate schedule and commission packages are saved together.', { exact: true })).toBeVisible();
      expect((await report()).commissionPercentage).toBe(12);
      await rates.getByRole('button', { name: 'Remove rate rule 1' }).click();
      await rates.getByRole('button', { name: 'Save rate schedule' }).click();
      await expect(page.getByText('Referral saved. Rate schedule and commission packages are saved together.', { exact: true })).toBeVisible();
      expect((await report()).commissionPercentage).toBe(5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

    } finally {
      if (connection) {
        for (const [collection, key] of [['retreatclients', 'booking'], ['clients', 'client'], ['retreats', 'retreat']]) await connection.db.collection(collection).deleteOne({ _id: ids[key] });
        await connection.close();
      }
      if (referralId) await request.delete(apiUrl + '/referrals/' + referralId, { headers });
    }
  });
}
