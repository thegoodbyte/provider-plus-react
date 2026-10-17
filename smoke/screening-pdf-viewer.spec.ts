import { test, expect } from '@playwright/test';
const fixture = 'http://127.0.0.1:43849';
const clientId = '507f1f77bcf86cd799439849';
const client = { _id: clientId, firstName: 'Screening', lastName: 'Fixture', display_id: 1849, email: 'screening@example.invalid', screeningData: { mainIntent: 'Synthetic test' } };

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'local-pdf-fixture');
    localStorage.setItem('user', JSON.stringify({ id: 'fixture-admin', role: 'admin', email: 'admin@example.invalid' }));
  });
  await page.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    if (path.startsWith(`/clients/${clientId}/screening/pdf`)) {
      const response = await route.fetch({ url: fixture + path });
      return route.fulfill({ response });
    }
    let data: any = [];
    if (path === `/clients/${clientId}`) data = client;
    if (path === '/environment/status') data = { production: true };
    if (path === '/users/navigation-permissions' || path === '/config-summary') data = {};
    if (path === '/submission-notifications/unread-count') data = { count: 0 };
    if (path.startsWith('/room-inventory/')) data = path.endsWith('/options') ? [] : null;
    return route.fulfill({ json: data });
  });
});

async function openViewer(page: any) {
  await page.goto(`/admin/clients/${clientId}/screening`);
  const pdfResponse = page.waitForResponse((r: any) => r.url().endsWith(`/clients/${clientId}/screening/pdf`) && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const response = await pdfResponse;
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByRole('dialog', { name: 'Screening PDF' })).toBeVisible();
  await expect(page.getByTitle('Screening PDF document')).toHaveAttribute('src', /^blob:/);
}

test('opens an existing generated PDF without regenerating', async ({ page, request }) => {
  await request.post(fixture + '/__fixture/reset/existing'); await openViewer(page);
  expect(await (await request.get(fixture + '/__fixture/state')).json()).toEqual({ generations: 0, stored: 1 });
  await expect(page.getByRole('link', { name: 'Download PDF', exact: true })).toHaveAttribute('download', 'screening.pdf');
  await page.getByRole('button', { name: 'Close PDF viewer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('generates a missing PDF and reuses the stored copy after reopening', async ({ page, request }) => {
  await request.post(fixture + '/__fixture/reset/missing'); await openViewer(page);
  expect(await (await request.get(fixture + '/__fixture/state')).json()).toEqual({ generations: 1, stored: 1 });
  await page.getByRole('button', { name: 'Close PDF viewer' }).click();
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await expect(page.getByTitle('Screening PDF document')).toHaveAttribute('src', /^blob:/);
  expect(await (await request.get(fixture + '/__fixture/state')).json()).toEqual({ generations: 1, stored: 1 });
});

test('regenerates the PDF and replaces the preview', async ({ page, request }) => {
  await request.post(fixture + '/__fixture/reset/existing'); await openViewer(page);
  const previous = await page.getByTitle('Screening PDF document').getAttribute('src');
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await expect(page.getByTitle('Screening PDF document')).not.toHaveAttribute('src', previous!);
  expect(await (await request.get(fixture + '/__fixture/state')).json()).toEqual({ generations: 1, stored: 1 });
  await page.screenshot({ path: 'test-results/ppvc-849-viewer.png', fullPage: true });
});

test('failed regeneration preserves the displayed PDF and Retry resumes generation', async ({ page, request }) => {
  await request.post(fixture + '/__fixture/reset/existing'); await openViewer(page);
  const previous = await page.getByTitle('Screening PDF document').getAttribute('src');
  await request.post(fixture + '/__fixture/fail-next');
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('previous copy is still available');
  await expect(page.getByTitle('Screening PDF document')).toHaveAttribute('src', previous!);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTitle('Screening PDF document')).not.toHaveAttribute('src', previous!);
  expect(await (await request.get(fixture + '/__fixture/state')).json()).toEqual({ generations: 2, stored: 1 });
});

 test('PDF endpoints require authentication in the integration fixture', async ({ request }) => {
  const response = await request.get(fixture + `/clients/${clientId}/screening/pdf`);
  expect(response.status()).toBe(403);
});

test('client Screening tab opens the same PDF viewer', async ({ page, request }) => {
  await request.post(fixture + '/__fixture/reset/existing');
  await page.goto(`/admin/clients/${clientId}`);
  await page.getByRole('button', { name: 'Screening Info', exact: true }).click();
  await page.getByRole('button', { name: 'View screening PDF', exact: true }).click();
  await expect(page.getByTitle('Screening PDF document')).toHaveAttribute('src', /^blob:/);
});

test('initial generation failure can be retried without closing the viewer', async ({ page, request }) => {
  await request.post(fixture + '/__fixture/reset/missing'); await request.post(fixture + '/__fixture/fail-next');
  await page.goto(`/admin/clients/${clientId}/screening`);
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not open');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByTitle('Screening PDF document')).toHaveAttribute('src', /^blob:/);
  expect(await (await request.get(fixture + '/__fixture/state')).json()).toEqual({ generations: 2, stored: 1 });
});
