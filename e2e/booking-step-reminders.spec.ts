import { test, expect } from '@playwright/test';

const retreatId = '507f1f77bcf86cd799439011';
const itemId = '507f1f77bcf86cd799439012';

test.describe('PPVC-325 booking step reminders', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }));
    });
  });

  test('previews and records an EKG reminder without completing the step', async ({ page }) => {
    let reminderPayload: any;
    const booking = {
      _id: 'booking-1', bookingNumber: 1201, status: 'confirmed', retreatId,
      clientId: { _id: 'client-1', firstName: 'Anna', lastName: 'Nowak', email: 'anna@example.com', display_id: 1001 },
    };
    const item = {
      _id: itemId, bookingId: booking, clientId: booking.clientId, retreatId,
      key: 'ekg_received', title: 'Entry EKG received', category: 'medical', status: 'pending',
      dueDate: '2026-08-12T00:00:00.000Z', order: 10, isBlocking: true,
    };

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.port === '3000') return route.continue();
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === `/retreats/${retreatId}`) return route.fulfill({ json: { _id: retreatId, name: 'Benešov retreat', code: 'BEN-08-20-26', startDate: '2026-08-20', endDate: '2026-08-27', status: 'upcoming' } });
      if (url.pathname === `/retreats/${retreatId}/hero-image-url`) return route.fulfill({ json: { heroImageUrl: null } });
      if (url.pathname === `/bookings/retreat/${retreatId}/with-details`) return route.fulfill({ json: [booking] });
      if (url.pathname === `/booking-flow/matrix/${retreatId}`) return route.fulfill({ json: { bookings: [booking], templates: [], items: [item], actionLogs: [] } });
      if (url.pathname === `/booking-flow/items/${itemId}/reminder-preview`) return route.fulfill({ json: {
        to: 'anna@example.com', subject: 'Reminder: we have not received Entry EKG',
        bodyText: 'Hi Anna,\n\nWe have not yet received Entry EKG. It was due on August 12, 2026.\n\nhttps://ibogaready.com/workflow?step=ekg_received',
        stepKey: 'ekg_received', stepTitle: 'Entry EKG received', dueDate: 'August 12, 2026',
        uploadUrl: 'https://ibogaready.com/workflow?step=ekg_received', actionKey: 'reminder:ekg_received',
        reminderCount: 1, lastReminderAt: '2026-08-08T10:00:00.000Z', duplicateBlocked: false,
        duplicateWarning: false, suggestedFollowUpDate: '2026-08-15', history: [{ _id: 'log-1', performedAt: '2026-08-08T10:00:00.000Z', performedByEmail: 'staff@example.com' }],
      } });
      if (url.pathname === `/booking-flow/items/${itemId}/send-reminder` && request.method() === 'POST') {
        reminderPayload = request.postDataJSON();
        return route.fulfill({ json: { sentEmail: { _id: 'sent-1', status: 'sent' }, item: { ...item, status: 'pending' } } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto(`/admin/retreats/${retreatId}/holisticView`);
    await page.getByRole('button', { name: 'Remind: Entry EKG received' }).click();
    await expect(page.getByRole('heading', { name: 'Reminder: Entry EKG received' })).toBeVisible();
    await expect(page.locator('input[value="Reminder: we have not received Entry EKG"]')).toBeVisible();
    await expect(page.getByText('1 previous reminder.')).toBeVisible();
    await expect(page.locator('input[type="date"][value="2026-08-15"]')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Send reminder' }).click();
    await expect.poll(() => reminderPayload).toBeTruthy();
    expect(reminderPayload).toMatchObject({
      subject: 'Reminder: we have not received Entry EKG',
      followUpDate: '2026-08-15',
      overrideDuplicate: false,
    });
    expect(item.status).toBe('pending');
  });
});
