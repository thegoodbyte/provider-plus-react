import { expect, test } from '@playwright/test';

test.describe('PPVC-491 referral payouts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-token');
      localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }));
    });
  });

  test('filters a partner and records selected commissions as a paid expense', async ({ page }) => {
    const referral = { _id: 'referral-1', name: 'Ada Partners', referralCode: 'AP', defaultCommissionPercentage: 10, isActive: true };
    const report = [
      { bookingId: 'booking-1', bookingNumber: 1401, clientId: 'client-1', clientDisplayId: 501, clientName: 'Eva Novak', clientEmail: 'eva@example.com', referralId: referral._id, referralName: referral.name, referralCode: referral.referralCode, retreatId: 'retreat-1', retreatCode: 'JNO-09', commissionPercentage: 10, amountOwed: 450, owedCurrency: 'EUR', paid: false },
      { bookingId: 'booking-2', bookingNumber: 1402, clientId: 'client-2', clientDisplayId: 502, clientName: 'Jan Kowalski', clientEmail: 'jan@example.com', referralId: referral._id, referralName: referral.name, referralCode: referral.referralCode, retreatId: 'retreat-1', retreatCode: 'JNO-09', commissionPercentage: 10, amountOwed: 300, owedCurrency: 'EUR', paid: false },
    ];
    let payout: any;

    await page.route('**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.port === '3000') return route.continue();
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === '/referrals' && request.method() === 'GET') return route.fulfill({ json: [referral] });
      if (url.pathname === '/referrals/report') return route.fulfill({ json: payout ? report.map(row => ({ ...row, paid: true, expenseId: 'expense-1', paidAt: '2026-08-14' })) : report });
      if (url.pathname === '/referrals/payouts' && request.method() === 'POST') {
        payout = request.postDataJSON();
        return route.fulfill({ json: { _id: 'expense-1', status: 'paid' } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/admin/referrals');
    await expect(page.getByRole('heading', { name: 'Referrals' })).toBeVisible();
    await page.getByRole('button', { name: /^AP Ada Partners/ }).click();
    await expect(page.getByRole('heading', { name: 'Clients referred by Ada Partners' })).toBeVisible();
    await expect(page.getByText(/€750\.00/).first()).toBeVisible();

    await page.getByRole('checkbox', { name: 'Select commission for booking 1401' }).check();
    await page.getByRole('checkbox', { name: 'Select commission for booking 1402' }).check();
    await page.getByRole('button', { name: 'Pay selected (2)' }).click();
    await expect(page.getByRole('dialog')).toContainText('€750.00');
    await page.getByLabel('Account').fill('Revolut EUR');
    await page.getByLabel('Reference').fill('REF-2026-08');
    await page.getByLabel('Notes').fill('August partner payout');
    await page.getByRole('button', { name: 'Record paid expense' }).click();

    await expect.poll(() => payout).toMatchObject({
      referralId: 'referral-1',
      retreatId: 'retreat-1',
      bookingIds: ['booking-1', 'booking-2'],
      paymentMethod: 'bank_transfer',
      paymentAccount: 'Revolut EUR',
      reference: 'REF-2026-08',
      notes: 'August partner payout',
    });
    await expect(page.getByRole('button', { name: 'Paid · view expense' })).toHaveCount(2);
  });
});
