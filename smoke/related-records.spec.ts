import { test, expect } from '@playwright/test';
const client = { _id: 'client-851', display_id: 1851, firstName: 'Direct', lastName: 'Link', email: 'direct@example.invalid', screeningData: {} };
const retreat = { _id: 'retreat-851', code: 'F-851', retreatCode: 'F-851', name: 'Related fixture retreat', type: 'regular', startDate: '2027-01-01', endDate: '2027-01-08', currency: 'EUR' };
const booking = { _id: 'booking-851', bookingNumber: 2851, clientId: client, retreatId: retreat, paymentRequestId: 'request-851', status: 'confirmed', bookingType: 'full_retreat', currency: 'EUR', totalAmount: 100, amountPaid: 100 };
const payment = { _id: 'payment-851', display_id: 3851, clientId: client, retreatId: retreat, bookingId: booking, paymentRequestId: 'request-851', amount: 100, currency: 'EUR', paymentDate: '2027-01-01', status: 'completed', paymentMethod: 'cash', paymentType: 'regular_payment' };
const requestRecord = { _id: 'request-851', display_id: 4851, invoiceNumber: 'INV-4851', clientId: client, retreatId: retreat, bookingId: booking, paymentId: payment, currency: 'EUR', requestedAmount: 100, amountPaid: 100, status: 'paid', requestType: 'full_payment', lineItems: [] };
test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => { localStorage.setItem('token', 'related-records-fixture'); localStorage.setItem('user', JSON.stringify({ id: 'fixture-admin', role: 'admin', email: 'admin@example.invalid' })); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    const path = url.pathname.replace(/^\/api(?=\/)/, ''); let data: any = [];
    if (path === '/clients') data = [client];
    if (path === `/clients/${client._id}`) data = client;
    if (path === '/retreats') data = [retreat];
    if (path === `/retreats/${retreat._id}`) data = retreat;
    if (path === '/bookings' || path.startsWith(`/bookings/retreat/${retreat._id}`)) data = [booking];
    if (path === `/bookings/${booking._id}`) data = booking;
    if (path === `/payments/${payment._id}`) data = payment;
    if (path === `/payment-requests/${requestRecord._id}`) data = requestRecord;
    if (path === '/environment/status') data = { production: true };
    if (path === '/users/navigation-permissions' || path === '/config-summary') data = {};
    if (path === '/submission-notifications/unread-count') data = { count: 0 };
    return route.fulfill({ json: data });
  });
});

test('payment footer opens the exact numbered client', async ({ page }) => {
  await page.goto(`/admin/payments/${payment._id}`);
  const related = page.getByRole('navigation', { name: 'Related records' });
  await expect(related.getByRole('link', { name: 'Booking #2851' })).toHaveAttribute('href', '/admin/bookings/booking-851');
  await expect(related.getByRole('link', { name: 'Payment request #4851' })).toHaveAttribute('href', '/admin/payment-requests/request-851');
  await related.getByRole('link', { name: 'Client #1851 · Direct Link' }).click();
  await expect(page).toHaveURL(/\/admin\/clients\/client-851$/);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});

test('booking footer links to its client, retreat and payment request', async ({ page }) => {
  await page.goto(`/admin/bookings/${booking._id}`);
  const related = page.getByRole('navigation', { name: 'Related records' });
  await expect(related.getByRole('link', { name: 'Client #1851 · Direct Link' })).toBeVisible();
  await expect(related.getByRole('link', { name: 'Retreat #F-851' })).toHaveAttribute('href', '/admin/retreats/retreat-851');
  await related.getByRole('link', { name: 'Payment request #4851' }).click();
  await expect(page).toHaveURL(/\/admin\/payment-requests\/request-851$/);
  await expect(page.getByRole('navigation', { name: 'Related records' }).getByRole('link', { name: 'Payment #3851', exact: true })).toBeVisible();
});

test('payment request footer opens the exact payment record', async ({ page }) => {
  await page.goto(`/admin/payment-requests/${requestRecord._id}`);
  await page.getByRole('navigation', { name: 'Related records' }).getByRole('link', { name: 'Payment #3851', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/payments\/payment-851$/);
  await expect(page.getByRole('navigation', { name: 'Related records' }).getByRole('link', { name: 'Booking #2851' })).toBeVisible();
});
