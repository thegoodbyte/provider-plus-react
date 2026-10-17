import { test, expect, Page } from '@playwright/test';

// PPVC-7: the client-detail view embedded inside a retreat's clients tab
// (opened via the "View Client" eye icon) only showed payment *requests* on
// its Payments tab, never the client's actual recorded payments -- a
// booking with real payments but no payment request showed an empty tab.

const retreatId = '507f1f77bcf86cd799439020';
const clientId = '507f1f77bcf86cd799439021';
const bookingId = '507f1f77bcf86cd799439022';
const paymentId = '507f1f77bcf86cd799439023';

const retreat = { _id: retreatId, name: 'October Retreat', code: 'OCT-26', capacity: 10, startDate: '2026-10-01', endDate: '2026-10-08' };
const client = { _id: clientId, firstName: 'Petra', lastName: 'Novakova', email: 'petra@example.test', display_id: 777 };
const booking = { _id: bookingId, clientId, retreatId, bookingNumber: 2001, status: 'confirmed', totalAmount: 900, currency: 'USD', amountPaid: 500, registrationDate: '2026-08-01' };
const payment = {
  _id: paymentId, display_id: 9001, clientId, amount: 500, currency: 'USD', status: 'completed',
  paymentMethod: 'bank_transfer', paymentType: 'deposit_refundable', paymentDate: '2026-08-05',
  retreatId: { _id: retreatId, name: retreat.name, retreatCode: retreat.code },
  bookingId: { _id: bookingId, bookingNumber: booking.bookingNumber },
};

async function mockApi(page: Page) {
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
    if (path === `/retreats/${retreatId}`) data = retreat;
    if (path === '/retreats') data = [retreat];
    if (path === `/bookings/retreat/${retreatId}/with-details`) data = [booking];
    if (path === `/retreat-expenses/retreat/${retreatId}/summary`) data = {};
    if (path === `/payments/by-booking/${bookingId}`) data = [];
    if (path === `/payments/by-booking-hash/${undefined}`) data = [];
    if (path === `/clients/${clientId}`) data = client;
    if (path === `/client-medical/client/${clientId}`) data = [];
    if (path === `/bookings/client/${clientId}`) data = [booking];
    if (path === `/notes/client/${clientId}`) data = [];
    if (path === '/payment-requests' && url.searchParams.get('clientId') === clientId) data = [];
    if (path === `/payments/by-client/${clientId}`) data = [payment];
    if (path === '/users/navigation-permissions' || path.includes('config-summary')) data = {};
    if (path === '/submission-notifications/unread-count') data = { count: 0 };
    if (path === '/environment/status') data = { production: true };
    return route.fulfill({ json: data });
  });
}

test('PPVC-7: the retreat-embedded client view shows the client\'s actual payment, not just payment requests', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/admin/retreats/${retreatId}`);
  await page.getByRole('button', { name: 'View Client' }).click();
  await expect(page.getByRole('heading', { name: `${client.firstName} ${client.lastName}` })).toBeVisible();
  await page.getByText('💳 Payments').click();
  await expect(page.getByText('💰 Payments')).toBeVisible();
  await expect(page.getByText('500 USD')).toBeVisible();
  await expect(page.getByText(new RegExp(`Booking: ${retreat.code} #${booking.bookingNumber}`))).toBeVisible();
  await expect(page.getByText('No payments recorded yet.')).toHaveCount(0);
});
