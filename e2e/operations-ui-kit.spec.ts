import { test, expect, Page } from '@playwright/test';

const client = { _id: 'c1', firstName: 'Anna', lastName: 'Kit', email: 'kit@example.invalid' };
const retreat = { _id: 'r1', name: 'Kit retreat', status: 'upcoming', startDate: '2099-05-01', endDate: '2099-05-08' };
const config = {
  timezone: 'Europe/Prague', owner: 'Synthetic owner', backup: 'Synthetic backup', bookingUrl: 'https://example.invalid/book',
  groupCalls: [{ key: 'call1', title: 'Group call 1', targetDay: 7, earliestDay: 5, latestDay: 9, durationMinutes: 60 }],
  personal: { count: 2, durationMinutes: 30, accessDays: 84, cancellationPolicy: 'restore', noShowPolicy: 'restore', extensionPolicy: 'staff_approval', maximumExtensionDays: 28 },
  emails: [{ key: 'welcome', title: 'Welcome', day: 1 }], channels: ['email'], dailyContactCap: 1, quietStart: '21:00', quietEnd: '09:00',
  review: { contentReference: 'synthetic-reviewed', contentReviewed: true, capacityReviewed: true },
};
async function mockReadOnly(page: Page) {
  await page.route('**/*', route => {
    const req = route.request();
    if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
    const url = new URL(req.url()), path = url.pathname.replace(/^\/api(?=\/)/, '');
    if (req.method() !== 'GET') throw new Error('Display/dialog check attempted a write: ' + path);
    let data: any = [];
    if (path === '/environment/status') data = { production: true };
    if (path === '/clients') data = [client];
    if (path === '/retreats') data = [retreat];
    if (path === '/bookings/b1') data = { _id: 'b1', bookingNumber: 9001, clientId: client, retreatId: retreat, status: 'confirmed', totalAmount: 1000, currency: 'EUR' };
    if (path === '/medical-review-requests/m1') data = { _id: 'm1', display_id: 9002, clientId: 'c1', retreatId: 'r1', artifactIds: [], status: 'pending', requestType: 'ekg_review' };
    if (path === '/medical-artifacts' && !url.searchParams.has('bookingId')) data = [{ _id: 'a1', clientId: 'c1', artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', title: 'Synthetic EKG', display_id: 9003, files: [] }];
    if (path === '/client-medical') data = [{ _id: 'med1', type: 'EKG', clientId: 'c1', date_received: '2026-11-01', medadvisor_review_result: 'OK' }];
    if (path === '/booking-flow/retreats/r1/workflow-summary') data = { unavailable: [], rows: [{
      _id: 'b1', clientId: 'c1', retreatId: 'r1', bookingNumber: 9001, clientName: 'Anna Kit', clientEmail: client.email, depositPaid: true,
      medicalRequirements: [{ type: 'ekg', label: 'EKG', state: 'approved' }, { type: 'liver_panel', label: 'Liver Panel', state: 'approved' }],
      reminders: [], readinessScore: 4, readinessState: 'ready', nextAction: 'Ready for retreat', missingItems: [], unavailable: [],
    }] };
    if (path === '/payments/by-client-and-retreat') data = [{ _id: 'p1', amount: 100, currency: 'EUR', paymentMethod: 'bank_transfer', status: 'completed' }];
    if (path === '/integration/programs') data = { programs: [{ _id: 'p1', name: 'Kit program', revision: 1, archived: false, draft: config, versions: [{ number: 1, name: 'Kit program', config, publishedAt: '2026-11-01' }] }], defaults: [], starter: config };
    if (path === '/integration/enrollments') data = { enrollments: [{ _id: 'e1', bookingId: 'b1', clientId: client, retreatId: 'r1', programId: 'p1', programVersion: 1, revision: 1, homecomingDate: '2026-11-01', status: 'active', snapshot: config }], bookings: [] };
    return route.fulfill({ json: data });
  });
}
async function trappedDialog(page: Page, name: string, lastButton: string) {
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: lastButton, exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  return dialog;
}
for (const width of [1440, 390]) {
  test.describe(`Operations shared kit ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });
    test.beforeEach(async ({ page }) => { await mockReadOnly(page); });
    test('medical statuses and file-link dialog retain draft selection and keyboard focus', async ({ page }, info) => {
      await page.goto('/admin/medical-tracking');
      await expect(page.getByText('Total Items', { exact: true })).toBeVisible();
      await expect(page.getByRole('table').getByText('OK', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('medical-cards.png') });
      await page.goto('/admin/medical-review-requests/m1/edit');
      const trigger = page.getByRole('button', { name: 'Add More Files', exact: true });
      await expect(trigger).toBeEnabled(); await trigger.click();
      const dialog = await trappedDialog(page, 'Link Client Files', 'Done');
      await dialog.getByRole('checkbox').check();
      await page.screenshot({ path: info.outputPath('medical-file-dialog.png') });
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      await trigger.click(); await expect(dialog.getByRole('checkbox')).toBeChecked();
      await dialog.getByRole('button', { name: 'Done', exact: true }).click(); await expect(dialog).toHaveCount(0);
    });
    test('workflow readiness and payment detail table retain their records', async ({ page }, info) => {
      await page.goto('/admin/workflow');
      const dashboard = page.locator('.workflow-dashboard');
      await expect(dashboard.getByText('4/4 checkpoints complete')).toBeVisible();
      await dashboard.getByRole('button', { name: 'payments', exact: true }).click();
      await expect(dashboard.getByRole('cell', { name: 'bank transfer', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath('workflow.png') });
    });
    test('booking upload dialog contains focus and Escape returns to its trigger', async ({ page }, info) => {
      await page.goto('/admin/bookings/b1');
      await page.getByRole('tab', { name: 'Medical', exact: true }).click();
      const trigger = page.getByRole('button', { name: 'Upload file', exact: true }).first();
      await trigger.click();
      const dialog = await trappedDialog(page, 'Upload medical artifact', 'Upload');
      await expect(dialog.getByLabel('Stage', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('booking-upload-dialog.png') });
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    });
    test('integration program and enrollment tables retain editable fields and records', async ({ page }, info) => {
      await page.goto('/admin/integration');
      await page.getByRole('button', { name: 'Programs & enrollments', exact: true }).click();
      const programs = page.getByRole('region', { name: 'Integration programs' });
      await programs.getByLabel('Choose program', { exact: true }).selectOption('p1');
      await expect(programs.getByRole('columnheader', { name: 'Target day', exact: true })).toBeVisible();
      await expect(programs.getByLabel('Group call 1 targetDay', { exact: true })).toHaveValue('7');
      await page.screenshot({ path: info.outputPath('integration-program.png') });
      await programs.getByRole('button', { name: 'Client enrollments', exact: true }).click();
      await expect(programs.getByRole('cell', { name: 'Anna Kit', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath('integration-enrollments.png') });
    });
  });
}
