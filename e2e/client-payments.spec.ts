import { test, expect, Page } from '@playwright/test';
const clientId = '507f1f77bcf86cd799439012';
const retreatId = '507f1f77bcf86cd799439013';
const bookingId = '507f1f77bcf86cd799439014';
const paymentId = '507f1f77bcf86cd799439015';
const client = { _id: clientId, firstName: 'Anna', lastName: 'Payment', email: 'anna@example.test' };
const retreat = { _id: retreatId, name: 'Autumn Retreat', startDate: '2030-10-01', endDate: '2030-10-08' };
const booking = { _id: bookingId, bookingNumber: 1300, clientId: client, retreatId: retreat, currency: 'EUR', totalAmount: 1000, status: 'confirmed' };
async function mockApi(page: Page, existing = false) {
  const state: { payment: any; bookings: any[]; creates: any[]; updates: any[] } = {
    payment: existing ? { _id: paymentId, display_id: 1002, clientId, amount: 150, currency: 'EUR', status: 'completed', paymentMethod: 'cash', description: 'Medical exam before booking', paymentDate: '2026-09-16' } : null,
    bookings: existing ? [booking] : [], creates: [], updates: [],
  };
  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-token');
    localStorage.setItem('user', JSON.stringify({ id: 'admin', role: 'admin', email: 'admin@example.test' }));
  });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    let data: any = [];
    if (path === '/clients') data = [client];
    if (path === '/retreats') data = [retreat];
    if (path === '/bookings') data = state.bookings;
    if (path === '/payments/next-display-id') data = 1002;
    if (path === '/payments/convert') data = { amount: Number(url.searchParams.get('amount')) };
    if (path === '/payments/convert-to-usd') data = { usd_amount: Number(url.searchParams.get('amount')) };
    if (path === '/payments') {
      if (request.method() === 'POST') { state.creates.push(request.postDataJSON()); state.payment = { ...request.postDataJSON(), _id: paymentId }; }
      data = request.method() === 'POST' ? state.payment : state.payment ? [state.payment] : [];
    }
    if (path === `/payments/${paymentId}`) {
      if (request.method() === 'PUT') { state.updates.push(request.postDataJSON()); state.payment = { ...state.payment, ...request.postDataJSON() }; }
      data = state.payment;
    }
    if (path === `/payments/by-client/${clientId}`) data = state.payment ? [state.payment] : [];
    if (path === `/payments/by-booking/${bookingId}`) data = state.payment?.bookingId === bookingId ? [state.payment] : [];
    if (path === `/payments/unlinked-candidates/by-booking/${bookingId}`) data = state.payment && !state.payment.bookingId ? [state.payment] : [];
    if (path === `/bookings/${bookingId}`) data = booking;
    if (path.endsWith('/with-details')) data = state.bookings;
    if (path.endsWith('/requirements')) data = { items: [], requirements: [], artifacts: [], documents: [], reviews: [] };
    if (path.includes('/payment-plan')) data = null;
    if (path === '/users/navigation-permissions' || path.includes('config-summary')) data = {};
    return route.fulfill({ json: data });
  });
  return state;
}

test('records a payment before any booking exists, then links the same payment through its editor', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto(`/admin/payments/new?clientId=${clientId}`);
  await expect(page.getByRole('checkbox', { name: 'Client payment (no booking yet)' })).toBeChecked();
  await page.getByLabel('Amount', { exact: true }).fill('150');
  await page.getByLabel('Status', { exact: true }).selectOption('completed');
  await page.getByLabel('Purpose *', { exact: true }).fill('Medical exam before booking');
  await page.getByRole('button', { name: 'Add Payment', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  expect(state.creates).toHaveLength(1);
  expect(state.creates[0]).toMatchObject({ clientId, amount: 150, description: 'Medical exam before booking' });
  for (const key of ['bookingId', 'retreatId', 'paymentRequestId']) expect(state.creates[0]).not.toHaveProperty(key);
  await expect(page.getByText('Client payment', { exact: true })).toBeVisible();
  await expect(page.getByText('Medical exam before booking', { exact: true })).toBeVisible();
  state.bookings = [booking];
  await page.goto(`/admin/payments/${paymentId}/edit`);
  await page.getByRole('button', { name: 'Link to a booking' }).click();
  await page.getByRole('combobox', { name: 'Search and select booking' }).fill('1300');
  await page.getByRole('option', { name: /1300/ }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('150');
  await page.getByRole('button', { name: 'Update Payment' }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  expect(state.updates).toHaveLength(1);
  expect(state.payment).toMatchObject({ _id: paymentId, bookingId, retreatId, amount: 150, currency: 'EUR', description: 'Medical exam before booking' });
  expect(state.creates).toHaveLength(1);
});

test('booking excludes client-only payments until staff link one from the existing payment control', async ({ page }) => {
  const state = await mockApi(page, true);
  await page.goto(`/admin/bookings/${bookingId}`);
  await page.getByRole('tab', { name: 'Payments', exact: true }).click();
  await expect(page.getByRole('button', { name: /view payment/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Link existing payment', exact: true }).click();
  await expect(page.getByRole('option', { name: /Medical exam before booking/ })).toBeAttached();
  await page.getByLabel('Existing Payment', { exact: true }).selectOption(paymentId);
  await page.getByRole('button', { name: 'Link Payment', exact: true }).click();
  await expect.poll(() => state.updates.length).toBe(1);
  expect(state.payment).toMatchObject({ bookingId, retreatId, clientId, amount: 150 });
  await expect(page.getByRole('button', { name: /view payment/i })).toBeVisible();
});
