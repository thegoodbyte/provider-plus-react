import { test, expect, Page } from '@playwright/test';

const bookingId = '507f1f77bcf86cd799439011';
const booking = {
  _id: bookingId, bookingNumber: 1247, status: 'confirmed', bookingType: 'full', totalAmount: 45000, currency: 'CZK',
  clientId: { _id: '507f1f77bcf86cd799439012', firstName: 'Denis', lastName: 'Solomon', email: 'denis@example.com' },
  retreatId: { _id: '507f1f77bcf86cd799439013', name: 'September retreat', startDate: '2026-09-22', endDate: '2026-09-29' },
};
async function mockBooking(page: Page, failInitially = false) {
  let failed = failInitially;
  let item = { _id: 'step-call', bookingId, key: 'call_client', title: 'Call client', category: 'task', status: 'pending', isBlocking: true, assignedTo: 'Reception', dueDate: '2026-09-01', order: 1 };
  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-token');
    localStorage.setItem('user', JSON.stringify({ id: 'admin', role: 'admin', email: 'admin@example.com' }));
  });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname.replace(/^\/api\//, '/');
    let data: any = [];
    if (path === `/bookings/${bookingId}`) data = booking;
    else if (path.includes('/with-details')) data = [booking];
    else if (path.endsWith('/requirements')) {
      if (failed) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
      data = { items: [item], requirements: [], artifacts: [], documents: [], reviews: [], documentCandidates: [] };
    } else if (path.endsWith('/workflow-snapshot')) data = { items: [item], actionLogs: [], documents: [] };
    else if (path.endsWith('/items/step-call') && request.method() === 'PATCH') {
      item = { ...item, ...request.postDataJSON() }; data = item;
    }
    return route.fulfill({ json: data });
  });
  return { recover: () => { failed = false; } };
}

test('next action opens its control and readiness updates after completing it', async ({ page }) => {
  await mockBooking(page);
  await page.goto(`/admin/bookings/${bookingId}`);
  const summary = page.getByRole('region', { name: 'Booking readiness and next action' });
  await expect(summary.getByRole('status')).toHaveText('Blocked');
  await expect(summary).toContainText('Reception');
  await summary.getByRole('button', { name: 'Open booking step: Call client' }).click();
  const step = page.locator('#booking-workflow-step-step-call');
  await expect(step).toBeFocused();
  await page.getByRole('button', { name: 'Edit steps & deadlines', exact: true }).click();
  await step.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect(summary.getByRole('status')).toHaveText('Ready');
  await expect(summary).toContainText('1 of 1 steps complete');
});

test('failed readiness is explicit and retry recovers on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await mockBooking(page, true);
  await page.goto(`/admin/bookings/${bookingId}`);
  const summary = page.getByRole('region', { name: 'Booking readiness and next action' });
  await expect(summary.getByRole('status')).toHaveText('Readiness unknown');
  await expect(summary.getByRole('alert')).toContainText('Unable to load readiness');
  mock.recover();
  await summary.getByRole('button', { name: 'Retry readiness' }).click();
  await expect(summary.getByRole('status')).toHaveText('Blocked');
  const bounds = await summary.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
