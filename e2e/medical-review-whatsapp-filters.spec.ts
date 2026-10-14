import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

for (const width of [1440, 390]) {
  test(`WhatsApp awaiting colors and shared filters at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const browserErrors: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    const requests = [
      { _id: 'waiting', display_id: 7901, status: 'awaiting_whatsapp', reviewChannel: 'whatsapp', whatsappStatus: 'awaiting_response', whatsappAdvisorUserId: 'advisor', assignedToUserId: 'other', retreatId: 'retreat', clientId: 'client', requestType: 'ekg_review', requestedAt: '2026-10-05T12:00:00Z' },
      { _id: 'approved', display_id: 7902, status: 'approved', reviewChannel: 'whatsapp', whatsappStatus: 'responded', whatsappDecision: 'OK', retreatId: 'retreat', clientId: 'client', requestType: 'liver_panel_review', requestedAt: '2026-10-04T12:00:00Z' },
      { _id: 'declined', display_id: 7903, status: 'rejected', reviewChannel: 'whatsapp', whatsappStatus: 'responded', whatsappDecision: 'NOT OK', retreatId: 'other-retreat', clientId: 'client', requestType: 'ekg_review' },
      { _id: 'internal', display_id: 7904, status: 'approved', reviewChannel: 'internal', clientId: 'client', requestType: 'ekg_review' },
    ];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL!).origin) return route.continue();
      const json = (value: unknown) => route.fulfill({ json: value });
      if (url.pathname === '/environment/status') return json({ environment: 'development', production: false, enabledJobs: [] });
      if (url.pathname === '/medical-review-requests') return json(requests);
      if (url.pathname === '/retreats') return json([{ _id: 'retreat', retreatCode: 'TEST-790' }, { _id: 'other-retreat', retreatCode: 'OTHER-790' }]);
      if (url.pathname === '/clients') return json([{ _id: 'client', firstName: 'Synthetic', lastName: 'Guest' }]);
      if (url.pathname === '/users') return json([{ _id: 'advisor', role: 'medical_advisor', firstName: 'Test', lastName: 'Advisor' }]);
      return json([]);
    });
    await page.goto('/admin/medical-review-requests');
    await page.getByRole('button', { name: 'WhatsApp handled', exact: true }).click();
    for (const label of ['Awaiting answer', '1 awaiting answer']) {
      const badge = page.getByText(label, { exact: true });
      await expect(badge).toHaveCSS('background-color', 'rgb(219, 234, 254)');
      await expect(badge).toHaveCSS('color', 'rgb(30, 64, 175)');
    }
    await expect(page.getByText('OK', { exact: true })).toHaveCSS('background-color', 'rgb(220, 252, 231)');
    await expect(page.getByRole('button', { name: '#7904', exact: true })).toHaveCount(0);
    const output = path.resolve(__dirname, '../../../ppvc-790-validation');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `whatsapp-${width}.png`), fullPage: true });
    for (const [status, id] of [['awaiting_whatsapp', '7901'], ['approved', '7902'], ['rejected', '7903']]) {
      await page.getByLabel('Status', { exact: true }).selectOption(status);
      await expect(page.getByRole('button', { name: `#${id}`, exact: true })).toHaveCount(1);
      for (const other of ['7901', '7902', '7903'].filter(value => value !== id)) {
        await expect(page.getByRole('button', { name: `#${other}`, exact: true })).toHaveCount(0);
      }
      await expect(page.getByText('1 handled via WhatsApp', { exact: true })).toHaveCount(1);
    }
    await page.getByLabel('Status', { exact: true }).selectOption('approved');
    await page.getByRole('combobox').filter({ has: page.locator('option[value="ekg"]') }).selectOption('ekg');
    await expect(page.getByText('No WhatsApp-handled MRRs match the current filters.')).toBeVisible();
    await page.getByRole('combobox').filter({ has: page.locator('option[value="ekg"]') }).selectOption('all');
    await page.getByLabel('Status', { exact: true }).selectOption('all');
    await page.getByLabel('Pending only').check();
    await page.getByLabel('Advisor', { exact: true }).selectOption('advisor');
    await expect(page.getByRole('button', { name: '#7901', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '#7902', exact: true })).toHaveCount(0);
    await page.getByLabel('Pending only').uncheck();
    await page.getByLabel('Advisor', { exact: true }).selectOption('all');
    await expect(page.getByRole('button', { name: '#7902', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '#7903', exact: true })).toHaveCount(1);
    for (const view of ['All', 'Grouped']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.getByLabel('Status', { exact: true }).selectOption('approved');
      if (view === 'Grouped') await page.getByRole('button', { name: /Potentials & unmatched/ }).click();
      await expect(page.getByRole('button', { name: '#7902', exact: true })).toHaveCount(1);
      await expect(page.getByRole('button', { name: '#7901', exact: true })).toHaveCount(0);
    }
    expect(browserErrors).toEqual([]);
  });
}
