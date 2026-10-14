import { expect, test } from '@playwright/test';
for (const width of [1440,1024,390,320]) {
 test(`review rows fit and retain actions at ${width}px`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: 1000 });
  const requests = [
   { _id: 'pending', display_id: 7971, status: 'pending', requestType: 'ekg_review', clientId: 'client', assignedToUserId: 'advisor', documentStage: 'initial', artifactReceivedAt: '2026-10-10', artifactReceivedVia: 'IbogaReady', requestedAt: '2026-10-11', source: 'IbogaReady' },
   { _id: 'whatsapp', display_id: 7972, status: 'awaiting_whatsapp', requestType: 'liver_panel_review', clientId: 'client', reviewChannel: 'whatsapp', whatsappStatus: 'awaiting_response', whatsappAdvisorUserId: 'advisor', whatsappSentAt: '2026-10-12', reviewNotes: 'A long synthetic clinical note to ensure that notes wrap without pushing the review actions outside the viewport.' },
  ];
  const errors: string[] = [];page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
   const request = route.request();if (!['xhr','fetch'].includes(request.resourceType())) return route.continue();
   const pathname = new URL(request.url()).pathname;
   const json = (value: any) => route.fulfill({ json: value });
   if (pathname === '/medical-review-requests') return json(requests);
   if (pathname === '/clients') return json([{ _id: 'client', firstName: 'Alexandria', lastName: 'Verylongsyntheticfamilyname', display_id: 501 }]);
   if (pathname === '/users') return json([{ _id: 'advisor', role: 'medical_advisor', firstName: 'Long', lastName: 'Advisor', email: 'long.advisor@example.test' }]);
   if (pathname === '/environment/status') return json({ environment: 'development', production: false, enabledJobs: [] });
   return json([]);
  });
  await page.goto('/admin/medical-review-requests');
  for (const name of ['Grouped','All','WhatsApp handled','Refresh','Add New Request']) {
   const control = page.getByRole('button', { name, exact: true });await expect(control).toBeVisible();
   const bounds = await control.boundingBox();expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  }
  await page.getByRole('button', { name: /Potentials & unmatched/ }).click();
  for (const view of ['Grouped','All','WhatsApp handled']) {
   await page.getByRole('button', { name: view, exact: true }).click();
   await expect(page.getByRole('button', { name: '#7972', exact: true })).toBeVisible();
   const rows = view === 'WhatsApp handled' ? page.locator('.mrr-whatsapp-table tbody tr') : page.locator('.mrr-list-row');
   for (const row of await rows.all()) {
    const bounds = await row.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width+1);
    for (const action of await row.getByRole('button').all()) {
     const box = await action.boundingBox();if (!box) continue;
     expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    }
   }
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   await rows.first().scrollIntoViewIfNeeded();
   await page.screenshot({ path: `../ppvc-797-validation/${view.replace(/ /g,'-')}-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'All', exact: true }).click();
  const row = page.locator('.mrr-list-row').filter({ has: page.getByRole('button', { name: '#7971', exact: true }) });
  await row.getByRole('button', { name: 'Open review', exact: true }).click();
  await expect(page).toHaveURL(/\/medical-review-requests\/pending$/);
  expect(errors).toEqual([]);
 });
}
