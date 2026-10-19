import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath = process.env.PPVC821_FIXTURE;
const f: any = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')) : {};
test.skip(!fixturePath, 'Requires the disposable PPVC-821 fixture');
test.describe.configure({ mode: 'serial' });
for (const width of [1440, 390]) test(`legacy payments remain paid or explicitly unresolved at ${width}px`, async ({ page, request }) => {
 await page.setViewportSize({ width, height: 980 });
 await page.addInitScript(token => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify({ id: 'synthetic', role: 'admin', email: 'admin@example.invalid' })); }, f.tokens.admin);
 await page.route('**/*', async route => {
  const req = route.request(); if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
  const url = new URL(req.url()); if (url.pathname.startsWith('/referrals')) { const response = await route.fetch({ url: f.url + url.pathname + url.search }); return route.fulfill({ response }); }
  if (url.pathname === '/environment/status') return route.fulfill({ json: { environment: 'local', production: false, enabledJobs: [] } });
  return route.fulfill({ json: [] });
 });
 await request.post(f.url + '/fixture/reset', { data: { scenario: 'direct' } });
 await page.goto('/admin/referrals/commissions'); await expect(page.getByRole('button', { name: 'Paid · view expense' })).toHaveCount(5);
 await expect(page.getByText('Already paid', { exact: true }).locator('..')).toContainText('4,500.00');
 await expect(page.getByLabel('Select commission for booking 1821', { exact: true })).toBeDisabled();
 await page.reload(); await expect(page.getByRole('button', { name: 'Paid · view expense' })).toHaveCount(5);
 await request.post(f.url + '/fixture/reset', { data: { scenario: 'whole' } }); await page.reload();
 await expect(page.getByRole('note')).toHaveCount(1); await expect(page.getByRole('note')).toContainText('Unallocated:');
 await expect(page.getByRole('note')).toContainText('4,500.00'); await expect(page.getByText('Payment allocation review needed', { exact: true })).toHaveCount(5);
 await expect(page.getByRole('button', { name: 'Pay', exact: true })).toHaveCount(0);
 await expect(page.getByText('Total owed', { exact: true })).toHaveCount(0);
 await page.getByRole('link', { name: 'Payment history', exact: true }).click();
 await expect(page.getByRole('note')).toContainText('unallocated'); await expect(page.getByRole('link', { name: 'View source expense' })).toHaveAttribute('href', /\/admin\/expenses\//);
 await expect(page.getByText('Recorded paid · PLN', { exact: true }).locator('..')).toContainText('4,500.00');
 await request.post(f.url + '/fixture/reset', { data: { scenario: 'partial' } });
 await page.goto('/admin/referrals/commissions'); await expect(page.getByRole('note')).toContainText('3,550.00'); await expect(page.getByRole('button', { name: 'Paid · view expense' })).toHaveCount(1);
 await expect(page.getByRole('button', { name: 'Pay', exact: true })).toHaveCount(0);
 await page.getByRole('note').scrollIntoViewIfNeeded();
 await page.screenshot({ path: `../ppvc-821-validation/legacy-${width}.png`, fullPage: true });
});
