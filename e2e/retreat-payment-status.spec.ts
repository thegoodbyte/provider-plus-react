import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) test(`retreat clients show calculated payment status at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const writes: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const cases = [
    { name: 'Partial Guest', currency: 'EUR', totalAmount: 5000, paid: 3000, label: 'Balance 2000.00 EUR' },
    { name: 'Overpaid Guest', currency: 'PLN', totalAmount: 850, paid: 1000, label: 'Overpaid 150.00 PLN' },
    { name: 'Paid Guest', currency: 'EUR', totalAmount: 5000, paid: 5000, label: 'Paid in full' },
    { name: 'Unpaid Guest', currency: 'USD', totalAmount: 750, paid: 0, label: 'Balance 750.00 USD' },
  ];
  const retreat = { _id: 'r933', name: 'Synthetic status retreat', code: 'T933', startDate: '2099-01-01', endDate: '2099-01-07', capacity: 20, status: 'scheduled', type: 'regular' };
  const bookings = cases.map((row, index) => ({ _id: `b${index}`, clientId: { _id: `c${index}`, display_id: 1933 + index, firstName: row.name.split(' ')[0], lastName: 'Guest', email: `guest${index}@example.invalid` }, retreatId: 'r933', bookingNumber: 2933 + index, status: 'confirmed', totalAmount: row.totalAmount, currency: row.currency }));
  await page.route('**/*', async route => {
    const req = route.request();
    if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
    const p = new URL(req.url()).pathname;
    if (req.method() !== 'GET') { writes.push(req.method() + ' ' + p); return route.fulfill({ status: 405, json: {} }); }
    if (p === '/environment/status') return route.fulfill({ json: { environment: 'local', production: false, enabledJobs: [] } });
    if (p === '/retreats/r933') return route.fulfill({ json: retreat });
    if (p === '/retreats') return route.fulfill({ json: [retreat] });
    if (p === '/bookings/retreat/r933/with-details') return route.fulfill({ json: bookings });
    if (p.startsWith('/payments/by-booking/')) {
      const index = Number(p.split('/').pop()!.slice(1)), row = cases[index];
      return route.fulfill({ json: row?.paid ? [{ _id: `p${index}`, bookingId: `b${index}`, clientId: `c${index}`, retreatId: 'r933', amount: row.paid, currency: row.currency, status: 'completed', paymentMethod: 'bank_transfer', paymentType: 'regular_payment', paymentDate: '2026-10-26' }] : [] });
    }
    if (p.includes('retreat-expenses')) return route.fulfill({ json: { totalExpenses: 0, categories: [] } });
    if (p === '/users/navigation-permissions') return route.fulfill({ json: {} });
    return route.fulfill({ json: [] });
  });
  await page.goto('/admin/retreats/r933');
  await expect(page.getByRole('columnheader', { name: 'Payment Status', exact: true })).toBeVisible();
  for (const [index, row] of cases.entries()) {
    const clientRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: row.name, exact: true }) });
    const badge = clientRow.getByText(row.label, { exact: true });
    await badge.scrollIntoViewIfNeeded();
    await expect(badge).toBeVisible();
    await expect(clientRow).not.toContainText('Reconciliation required');
    await badge.screenshot({ path: `${process.env.PAYMENT_STATUS_ARTIFACT_DIR || '../ppvc-933-validation'}/status-${index}-${width}.png` });
  }
  await page.reload();
  await expect(page.getByText('Balance 2000.00 EUR', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
