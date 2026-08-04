import { expect, test } from '@playwright/test';

const bookingId = '507f1f77bcf86cd799439801';
const clientId = '507f1f77bcf86cd799439802';
const retreatId = '507f1f77bcf86cd799439803';

test.describe('PPVC-335 booking activity timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }));
    });
  });

  test('shows a chronological, filterable trail with actors and automatic actions', async ({ page }) => {
    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.port === '3000') return route.continue();
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === `/bookings/${bookingId}`) return route.fulfill({ json: {
        _id: bookingId,
        bookingNumber: 1401,
        status: 'confirmed',
        totalAmount: 4200,
        currency: 'EUR',
        clientId: { _id: clientId, firstName: 'Anna', lastName: 'Nowak', email: 'anna@example.com', display_id: 1301 },
        retreatId: { _id: retreatId, name: 'BEN-10-01-26', code: 'BEN-10-01-26', startDate: '2026-10-01', endDate: '2026-10-08' },
      } });
      if (url.pathname === `/bookings/${bookingId}/activity`) return route.fulfill({ json: [
        {
          id: 'decision-1', type: 'medical_decision', title: 'Medical decision: OK', description: 'Cleared for retreat',
          occurredAt: '2026-08-04T10:00:00.000Z', actor: 'doctor@example.com', automatic: false, source: 'medical_review',
        },
        {
          id: 'automatic-1', type: 'step', title: 'Payment received auto-marked', description: 'pending → received',
          occurredAt: '2026-08-04T09:00:00.000Z', actor: 'System', automatic: true, source: 'booking_flow_action',
        },
        {
          id: 'file-1', type: 'file_uploaded', title: 'Entry EKG artifact uploaded', description: 'ekg.pdf',
          occurredAt: '2026-08-04T08:00:00.000Z', actor: 'admin@example.com', automatic: false, source: 'medical_artifact',
        },
      ] });
      if (url.pathname === '/booking-flow/items' && url.searchParams.get('bookingId') === bookingId) return route.fulfill({ json: [] });
      return route.fulfill({ json: [] });
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await page.getByRole('tab', { name: 'Activity' }).click();

    const timeline = page.getByLabel('Booking activity timeline');
    await expect(timeline.getByRole('heading', { name: 'Activity Timeline' })).toBeVisible();
    await expect(timeline.getByText('Medical decision: OK')).toBeVisible();
    await expect(timeline.getByText('doctor@example.com')).toBeVisible();
    await expect(timeline.getByText('Payment received auto-marked')).toBeVisible();
    await expect(timeline.getByText('Automatic')).toBeVisible();
    await expect(timeline.getByText('Entry EKG artifact uploaded')).toBeVisible();
    await expect(timeline.getByText('admin@example.com')).toBeVisible();

    const titles = await page.locator('ol li .font-semibold.text-gray-900').allTextContents();
    expect(titles).toEqual(['Medical decision: OK', 'Payment received auto-marked', 'Entry EKG artifact uploaded']);

    await timeline.getByRole('button', { name: 'Medical (1)' }).click();
    await expect(timeline.getByText('Medical decision: OK')).toBeVisible();
    await expect(timeline.getByText('Payment received auto-marked')).toHaveCount(0);
    await expect(timeline.getByText('Entry EKG artifact uploaded')).toHaveCount(0);
  });
});
