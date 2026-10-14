import { expect, test } from '@playwright/test';
const client = { _id: 'c1', firstName: 'Synthetic', lastName: 'Guest', email: 'original@example.invalid', phone: '+420777123456', status: 'active', language: 'EN', country: 'CZ' };
const retreat = { _id: 'r1', name: 'Test retreat', startDate: '2026-11-01', endDate: '2026-11-08', capacity: 20, status: 'active' };
const fixture = (kind: string) => `/e2e/fixtures/feedback.html?case=${kind}`;
for (const width of [1440, 390]) {
 test(`client editors, user feedback and retained drafts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  let patches = 0; const nativeDialogs: string[] = [];
  page.on('dialog', async dialog => { nativeDialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.route('**/*', async route => {
   const request = route.request(); if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
   const url = new URL(request.url()), method = request.method();
   const json = (value: any, status = 200) => route.fulfill({ status, json: value, headers: { 'Access-Control-Allow-Origin': 'http://localhost:4376', 'Access-Control-Allow-Credentials': 'true' } });
   if (url.pathname === '/clients/c1' && method === 'PATCH') { patches++; return json({ message: 'Email taken@example.invalid is already registered.' }, 400); }
   if (url.pathname === '/clients/c1') return json(client);
   if (url.pathname === '/clients' || url.pathname === '/clients/booking-options') return json([client]);
   if (url.pathname === '/users' && method === 'POST') return json({ message: 'Email taken@example.invalid is already registered.' }, 400);
   if (url.pathname.endsWith('/reset-password')) return json({});
   if (url.pathname === '/users') return json([{ _id: 'u1', email: 'existing@example.invalid', isActive: true, role: 'user' }]);
   if (url.pathname === '/environment/status') return json({ environment: 'local', production: false, enabledJobs: [] });
   return json([]);
  });
  await page.goto('/admin/clients/c1/edit');
  await page.getByLabel(/^Email/).fill('taken@example.invalid');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Duplicate email' })).toHaveText('Duplicate email');
  await expect(page.getByLabel(/^Email/)).toHaveValue('taken@example.invalid');
  await expect(page.getByRole('heading', { name: 'Request could not be completed' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.goto(fixture('modal'));
  await page.getByLabel(/^Email/).fill('taken@example.invalid');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Duplicate email' })).toHaveText('Duplicate email');
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page.getByLabel(/^Email/)).toHaveValue('taken@example.invalid');
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByLabel(/^Email/).fill('taken@example.invalid');
  await page.getByLabel(/^Password/).fill('Safe!Password126');
  await page.getByLabel(/^Confirm Password/).fill('Safe!Password126');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Duplicate email' })).toHaveText('Duplicate email');
  await expect(page.getByLabel(/^Email/)).toHaveValue('taken@example.invalid');
  await expect(page.getByRole('heading', { name: 'Notification' })).toHaveCount(0);
  await page.screenshot({ path: `../ppvc-796-validation/user-${width}.png` });
  expect(patches).toBe(2); expect(nativeDialogs).toEqual([]);
 });
 test(`read recovery, upload, booking, review, email and payment feedback at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  let paymentWrites = 0, emailWrites = 0;
  page.on('dialog', async dialog => dialog.accept());
  await page.route('**/*', async route => {
   const req = route.request(); if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
   const url = new URL(req.url()), method = req.method(); const json = (value: any, status = 200) => route.fulfill({ status, json: value, headers: { 'Access-Control-Allow-Origin': 'http://localhost:4376', 'Access-Control-Allow-Credentials': 'true' } });
   if (url.pathname === '/test-loading') return json({ message: 'MongoServerError secret' }, 503);
   if (url.pathname === '/clients' || url.pathname === '/clients/booking-options') return json([client]);
   if (url.pathname === '/retreats') return json([retreat]);
   if (url.pathname === '/bookings/booking-number-available') return json({ available: true });
   if (url.pathname === '/bookings/next-booking-number') return json(1202);
   if (url.pathname === '/bookings/b1' && method === 'PATCH') return json({ message: 'The retreat is full.' }, 409);
   if (url.pathname === '/bookings/b1') return json({ _id: 'b1', bookingNumber: 1201, clientId: client, retreatId: retreat, totalAmount: 1000, currency: 'EUR', status: 'confirmed' });
   if (url.pathname === '/medical-artifacts' && method === 'POST') return json({ message: 'Denied' }, 403);
   if (url.pathname === '/medical-review-requests/mrr1' && method === 'PATCH') return json({ message: 'Review status changed. Check the current review before saving.' }, 409);
   if (url.pathname === '/communications/send') { emailWrites++; return json({ status: 'failed', integrationSafeRetry: false, errorMessage: 'secret provider detail' }); }
   if (url.pathname === '/communications/settings') return json({});
   if (url.pathname === '/payment-requests/p1' && method === 'DELETE') { paymentWrites++; return json({ message: 'Provider failure' }, 503); }
   if (url.pathname === '/payment-requests') return json([{ _id: 'p1', clientId: client, amount: 100, currency: 'EUR', status: 'pending', paymentDate: '2026-10-14', createdAt: '2026-10-14' }]);
   return json([]);
  });
  await page.goto(fixture('read')); await page.getByLabel('Unsaved draft').fill('Retained notes'); await page.getByRole('button', { name: 'Load information' }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page.getByLabel('Unsaved draft')).toHaveValue('Retained notes');
  await page.getByRole('button', { name: 'Dismiss loading message' }).click();
  await expect(page.getByLabel('Unsaved draft')).toHaveValue('Retained notes');
  await page.goto(fixture('booking'));
  await page.getByRole('button', { name: 'Update Booking' }).click();
  await expect(page.getByRole('alert')).toHaveText('The retreat is full.');
  await page.goto(fixture('documents'));
  const file = page.locator('#booking-medical-document-ekg'); await file.setInputFiles({ name: 'ekg.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic pdf') });
  await expect(page.getByText('You do not have permission to perform this action.').first()).toBeVisible();
  expect(await file.evaluate((input: HTMLInputElement) => input.files?.[0].name)).toBe('ekg.pdf');
  await page.goto(fixture('review'));
  await page.getByRole('button', { name: 'Save and return to list' }).click();
  await expect(page.getByRole('alert')).toContainText('Review status changed');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goto(fixture('email'));
  await page.getByRole('button', { name: 'Send Email', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email delivery could not be confirmed');
  await expect(page.getByRole('button', { name: 'Send Email', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).not.toContainText('secret'); expect(emailWrites).toBe(1);
  await page.screenshot({ path: `../ppvc-796-validation/email-${width}.png` });
  await page.goto(fixture('payments')); await page.getByTitle('Delete', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check payment history'); expect(paymentWrites).toBe(1);
  await expect(page.getByRole('heading', { name: 'Request could not be completed' })).toHaveCount(0);
 });
}
