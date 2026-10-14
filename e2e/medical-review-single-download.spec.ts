import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`single MRR WhatsApp download and retry at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    let fail = true;
    const selectedIds: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const fileName = 'MRR_7921_DANA.BABICOVA_501_JNO-10-27-26.zip';
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/synthetic-mrr.zip') return route.fulfill({ contentType: 'application/zip', headers: { 'Content-Disposition': `attachment; filename="${fileName}"` }, body: Buffer.from('PK-synthetic-download') });
      if (url.origin === new URL(baseURL!).origin) return route.continue();
      if (url.pathname === '/environment/status') return route.fulfill({ json: { environment: 'development', production: false, enabledJobs: [] } });
      if (url.pathname === '/medical-review-requests') return route.fulfill({ json: [
        { _id: 'selected-mrr', display_id: 7921, status: 'awaiting_whatsapp', reviewChannel: 'whatsapp', whatsappStatus: 'awaiting_response', requestType: 'ekg_review', clientId: 'client' },
        { _id: 'other-mrr', display_id: 7922, status: 'approved', reviewChannel: 'whatsapp', whatsappStatus: 'responded', whatsappDecision: 'OK', requestType: 'liver_panel_review', clientId: 'client' },
      ] });
      if (url.pathname === '/clients') return route.fulfill({ json: [{ _id: 'client', firstName: 'Dana', lastName: 'Babičová', display_id: 501 }] });
      if (url.pathname.endsWith('/whatsapp-download')) {
        selectedIds.push(url.pathname.split('/')[2]);
        if (fail) return route.fulfill({ status: 404, json: { message: 'No downloadable documents are attached to this medical review request.' } });
        return route.fulfill({ json: { url: `${baseURL}/synthetic-mrr.zip`, fileName, fileCount: 2 } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('/admin/medical-review-requests');
    await page.getByRole('button', { name: 'WhatsApp handled', exact: true }).click();
    const action = page.getByRole('button', { name: 'Download MRR #7921 for WhatsApp', exact: true });
    await action.click();
    await expect(page.getByText('No downloadable documents are attached to this medical review request.')).toBeVisible();
    await expect(action).toBeEnabled();
    await expect(page.getByRole('button', { name: '#7922', exact: true })).toHaveCount(1);
    fail = false;
    const downloadEvent = page.waitForEvent('download');
    await action.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(fileName);
    expect(await download.failure()).toBeNull();
    expect(selectedIds).toEqual(['selected-mrr', 'selected-mrr']);
    await expect(action).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
