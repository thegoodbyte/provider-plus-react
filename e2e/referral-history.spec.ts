import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test.skip(process.env.PPVC784_LOCAL_E2E !== '1', 'Requires the isolated --referral-history stack');
test.describe.configure({ mode: 'serial' });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`all referral payment sources and filters at ${viewport.width}px`, async ({ page, request, baseURL }) => {
    test.setTimeout(90000);
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const workspace = path.resolve(__dirname, '../../..');
    const mongoose = require(path.join(workspace, 'release-20261014-referrals/api/node_modules/mongoose'));
    const credentials = JSON.parse(fs.readFileSync(path.join(workspace, 'ppvc-660-db-refresh/db-refresh-private/local-credentials.json'), 'utf8'));
    const uri = new URL(credentials.appUri);
    expect(uri.hostname).toBe('127.0.0.1'); expect(uri.port).toBe('27073'); expect(uri.pathname).toBe('/re_local');
    const api = 'http://localhost:3005';
    const login = await request.post(api + '/auth/login', { data: JSON.parse(fs.readFileSync(path.join(workspace, 'ppvc-660-db-refresh/db-refresh-private/local-admin-login.json'), 'utf8')) });
    expect(login.ok()).toBeTruthy(); const session = await login.json();
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const connection = await mongoose.createConnection(credentials.appUri).asPromise();
    const db = connection.db;
    const marker = `PPVC784-${randomUUID().slice(0, 8)}`;
    const ids: any = Object.fromEntries(['partner', 'retreat', 'client', 'booking', 'ordinaryType', 'canonical', 'linked', 'snapshot', 'tagged', 'category', 'pending', 'voided', 'ordinary', 'planned'].map(key => [key, new mongoose.Types.ObjectId()]));
    let createdType: any;
    try {
      let referralType = await db.collection('expensetypes').findOne({ key: 'referral_commissions' });
      if (!referralType) {
        createdType = new mongoose.Types.ObjectId(); referralType = { _id: createdType, key: 'referral_commissions', name: 'Referral commissions' };
        await db.collection('expensetypes').insertOne(referralType);
      }
      await db.collection('expensetypes').insertOne({ _id: ids.ordinaryType, key: marker, name: marker });
      await db.collection('referrals').insertOne({ _id: ids.partner, name: `${marker} Partner`, isActive: true });
      await db.collection('retreats').insertOne({ _id: ids.retreat, name: `${marker} Retreat`, code: marker });
      const common = { expenseKind: 'actual', expenseTypeId: ids.ordinaryType, status: 'paid', currency: 'USD', expenseDate: new Date('2026-10-13'), description: marker, vendor: `${marker} Partner` };
      const records = [
        { ...common, _id: ids.canonical, amount: 50, receiptNumber: marker + '-canonical', referralId: ids.partner, retreatId: ids.retreat, referralPayment: { referralName: marker + ' Snapshot partner' }, referralPayoutItems: [{ bookingId: ids.booking, clientId: ids.client, referralId: ids.partner, clientName: marker + ' Guest', bookingNumber: 999784, amount: 50, currency: 'USD' }] },
        { ...common, _id: ids.linked, amount: 20, referralId: ids.partner, receiptNumber: marker + '-linked' },
        { ...common, _id: ids.snapshot, amount: 30, referralPayment: { referralId: String(ids.partner), retreatId: String(ids.retreat), referralName: marker + ' Snapshot only' }, receiptNumber: marker + '-snapshot' },
        { ...common, _id: ids.tagged, amount: 40, currency: 'EUR', tags: ['referral'], receiptNumber: marker + '-tagged' },
        { ...common, _id: ids.category, amount: 60, expenseTypeId: referralType._id, receiptNumber: marker + '-category' },
        { ...common, _id: ids.pending, amount: 9000, status: 'pending', referralId: ids.partner, receiptNumber: marker + '-pending' },
        { ...common, _id: ids.voided, amount: 0, status: 'rejected', referralId: ids.partner, referralPayment: { originalAmount: 8000, voidedAt: new Date(), voidReason: 'Synthetic correction' }, receiptNumber: marker + '-voided' },
        { ...common, _id: ids.ordinary, amount: 7000, receiptNumber: marker + '-ordinary' },
        { ...common, _id: ids.planned, amount: 6500, status: 'planned', expenseKind: 'planned', referralId: ids.partner, receiptNumber: marker + '-planned' },
      ];
      await db.collection('retreatexpenses').insertMany(records);
      expect((await request.get(api + '/referrals/payouts')).status()).toBe(401);
      expect((await request.get(api + '/referrals/payouts?referralId=invalid', { headers })).status()).toBe(400);
      const allResponse = await request.get(api + '/referrals/payouts', { headers });
      expect(allResponse.ok()).toBeTruthy(); const all = await allResponse.json();
      const ours = all.filter((item: any) => item.description === marker);
      expect(ours).toHaveLength(8);
      expect(ours.some((item: any) => item._id === String(ids.ordinary))).toBeFalsy();
      const scopedResponse = await request.get(api + `/referrals/payouts?referralId=${ids.partner}`, { headers });
      expect(scopedResponse.ok()).toBeTruthy(); const scoped = await scopedResponse.json();
      expect(scoped).toHaveLength(6); // Unlinked tagged/category records stay in the all-payments view.
      expect(scoped.some((item: any) => item._id === String(ids.snapshot))).toBeTruthy();
      const retreatResponse = await request.get(api + `/referrals/payouts?retreatId=${ids.retreat}`, { headers });
      expect((await retreatResponse.json())).toHaveLength(2);
      await page.setViewportSize(viewport);
      await page.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, { token: session.access_token, user: session.user });
      await page.route('**/*', route => /^(localhost|127\.0\.0\.1)$/.test(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await page.goto(`/admin/referrals/payments?referralId=${ids.partner}`);
      await page.getByLabel('Search referral payments').fill(marker);
      await expect(page.getByText('6 payment records · 3 paid', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Show all payments' }).click();
      await page.getByLabel('Search referral payments').fill(marker);
      await expect(page.getByText('8 payment records · 5 paid', { exact: true })).toBeVisible();
      const history = page.getByRole('region', { name: 'Referral payment history' });
      await expect(history.getByText('Recorded paid · USD').locator('..')).toContainText('$160.00');
      await expect(history.getByText('Recorded paid · EUR').locator('..')).toContainText('€40.00');
      await expect(page.getByText(marker + '-ordinary', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Expense without booking allocations', { exact: true })).toHaveCount(7);
      await expect(page.getByRole('button', { name: 'Void incorrect record' })).toHaveCount(1);
      await expect(page.getByRole('link', { name: /999784/ })).toHaveAttribute('href', '/admin/bookings/' + ids.booking);
      await page.getByLabel('Payment record status').selectOption('paid');
      await expect(page.getByText('5 payment records · 5 paid', { exact: true })).toBeVisible();
      await page.getByLabel('Payment from date').fill('2026-10-14');
      await expect(page.getByText('No referral payments match these filters.')).toBeVisible();
      await page.getByLabel('Payment from date').fill('2026-10-13');
      await page.getByLabel('Payment through date').fill('2026-10-13');
      await expect(page.getByText('5 payment records · 5 paid', { exact: true })).toBeVisible();
      await page.getByLabel('Search referral payments').fill(marker + '-category');
      await expect(page.getByText('1 payment record · 1 paid', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'View expense' })).toHaveAttribute('href', '/admin/expenses/' + ids.category);
      await page.getByLabel('Search referral payments').fill(marker);
      const output = path.join(workspace, 'ppvc-784-validation'); fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `history-${viewport.width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    } finally {
      await db.collection('retreatexpenses').deleteMany({ _id: { $in: Object.values(ids).filter(value => value instanceof mongoose.Types.ObjectId) } });
      await db.collection('referrals').deleteOne({ _id: ids.partner });
      await db.collection('retreats').deleteOne({ _id: ids.retreat });
      await db.collection('expensetypes').deleteOne({ _id: ids.ordinaryType });
      if (createdType) await db.collection('expensetypes').deleteOne({ _id: createdType });
      await connection.close();
    }
  });
}
