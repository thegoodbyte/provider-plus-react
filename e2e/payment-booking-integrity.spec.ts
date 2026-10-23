import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const path = process.env.PPVC902_FIXTURE;
const f: any = path ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
test.skip(!path, 'Requires disposable PPVC-902 Mongo/Nest fixture.');
test.describe.configure({ mode: 'serial' });
for (const width of [1440, 390]) test(`clear primary and reschedule preserve financial history at ${width}px`, async ({ page, request }) => {
 await request.post(f.url + '/fixture/reset', { data: {} }); await page.setViewportSize({ width, height: 980 });
 const snapshot = async () => (await request.get(f.url + '/fixture/snapshot')).json();
 const before = await snapshot(); const client = { _id: f.client, firstName: 'Synthetic', lastName: 'Client', email: 'synthetic@example.invalid', display_id: 1902 };
 const retreats = [{ ...before.bookings[0], _id: f.retreat, name: 'Synthetic Retreat', code: 'SYN902', startDate: '2099-01-01', endDate: '2099-01-07', capacity: 10, type: 'regular' }, { _id: f.targetRetreat, name: 'New Synthetic Retreat', code: 'SYN902-NEW', startDate: '2099-02-01', endDate: '2099-02-07', capacity: 10, type: 'regular' }];
 await page.addInitScript(token => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify({ id: 'synthetic-admin', role: 'admin', email: 'admin@example.invalid' })); }, f.tokens.admin);
 await page.route('**/*', async route => {
  const r = route.request(); if (!['xhr', 'fetch'].includes(r.resourceType())) return route.continue(); const u = new URL(r.url());
  if (u.pathname === '/bookings/booking-number-available') return route.fulfill({ json: { available: true } });
  if (u.pathname === '/clients/booking-options') return route.fulfill({ json: [client] });
  if (u.pathname.startsWith('/payments/plan-settings/booking/')) return route.fulfill({ status: 503, json: { message: 'Optional planner disabled in fixture' } });
  if (u.pathname === '/bookings/' + f.booking || u.pathname === '/bookings/' + f.booking + '/reschedule' || u.pathname.startsWith('/payments') || u.pathname.startsWith('/payment-requests')) {
   const response = await route.fetch({ url: f.url + u.pathname + u.search }); return route.fulfill({ response });
  }
  if (u.pathname.startsWith('/bookings')) { const s = await snapshot(); return route.fulfill({ json: s.bookings }); }
  if (u.pathname === '/clients/' + f.client) return route.fulfill({ json: client });
  if (u.pathname === '/clients') return route.fulfill({ json: [client] });
  if (u.pathname.startsWith('/retreats/')) return route.fulfill({ json: retreats.find(r => r._id === u.pathname.split('/')[2]) || [] });
  if (u.pathname === '/retreats') return route.fulfill({ json: retreats });
  if (u.pathname.includes('config-summary')) return route.fulfill({ json: {} });
  if (u.pathname === '/environment/status') return route.fulfill({ json: { environment: 'local', production: false, enabledJobs: [] } });
  return route.fulfill({ json: [] });
 });
 const dismiss = async () => { const toast = page.getByRole('button', { name: 'Dismiss loading message' }); if (await toast.isVisible()) await toast.click(); };
 await page.goto('/admin/bookings/' + f.booking + '/edit'); await page.getByRole('button', { name: 'Clear selection', exact: true }).click(); await dismiss(); await page.getByRole('button', { name: 'Update Booking', exact: true }).click();
 await expect.poll(async () => (await snapshot()).bookings[0].paymentRequestId).toBe(null);
 await page.goto('/admin/bookings/' + f.booking + '/edit'); await expect(page.getByRole('button', { name: 'Update Booking', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Clear selection', exact: true })).toHaveCount(0);
 expect((await snapshot()).requests).toEqual(before.requests);
 // Restore primary through the real endpoint, then test the reschedule dialog.
 await request.patch(f.url + '/bookings/' + f.booking, { headers: { Authorization: 'Bearer ' + f.tokens.admin }, data: { paymentRequestId: f.request } });
 await page.goto('/admin/bookings/' + f.booking); await dismiss(); await page.getByLabel('More booking actions', { exact: true }).click(); await page.getByRole('button', { name: 'Reschedule booking', exact: true }).click();
 const dialog = page.getByRole('dialog'); await dialog.getByRole('combobox', { name: /Move to retreat/ }).selectOption(f.targetRetreat); await dialog.getByRole('textbox', { name: /Internal note/ }).fill('Synthetic dates changed');
 const clear = dialog.getByRole('checkbox', { name: /Clear the primary payment request link/ }); await expect(clear).not.toBeChecked(); await clear.check(); await expect(dialog.getByRole('checkbox', { name: /Send reschedule email/ })).not.toBeChecked(); await dismiss(); await dialog.getByRole('button', { name: 'Confirm reschedule' }).click();
 await expect.poll(async () => (await snapshot()).bookings[0].retreatId).toBe(f.targetRetreat); await expect(dialog).toHaveCount(0);
 await page.getByRole('tab', { name: 'Payments', exact: true }).click(); const row = page.locator('.booking-payment-request-row').filter({ hasText: '1899' }); await expect(row).toHaveCount(1); await row.scrollIntoViewIfNeeded(); await dismiss(); await page.screenshot({ path: `../ppvc-902-validation/history-${width}.png`, fullPage: true });
 const after = await snapshot(); expect(after.bookings[0].paymentRequestId).toBe(null); expect(after.requests).toEqual(before.requests); expect(after.payments).toEqual(before.payments); expect(after.receipts).toEqual(before.receipts); expect(after.bookings[0].totalAmount).toBe(1000);
});
