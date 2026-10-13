import { test, expect } from '@playwright/test';
// Requires test/payment-receipt-browser-fixture.cjs in the API repository.
// Receipt operations reach a real Nest controller/service and isolated local MongoDB.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE ERROR:', message.text()); });
  await page.addInitScript(() => { localStorage.setItem('token', 'receipt-test-staff'); localStorage.setItem('user', JSON.stringify({ id: 'staff', email: 'staff@example.invalid', role: 'admin' })); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.port === '4390' || url.pathname.startsWith('/payments/receipts') || url.pathname === '/fixture') return route.continue();
    // Unrelated shell data is synthetic. Receipt APIs are never intercepted.
    if (url.pathname === '/environment/status') return route.fulfill({ json: { environment: 'test', outboundMode: 'capture', enabledJobs: [] } });
    if (url.pathname === '/assistant/tasks-for-today') return route.fulfill({ json: { tasks: [], retreats: [] } });
    if (url.pathname === '/launcher-config') return route.fulfill({ json: { assignments: [] } });
    if (url.pathname === '/communications/email-safety') return route.fulfill({ json: { enabled: true } });
    if (url.hostname.includes('exchangerate') || url.hostname.includes('fxrates')) return route.fulfill({ json: { rates: { EUR: 1, USD: 1, PLN: 4, CZK: 25 } } });
    return route.fulfill({ json: [] });
  });
  page.on('dialog', dialog => dialog.accept());
});
test('automatic PDF, download, regeneration, email attachment and persisted history', async ({ page, request }, info) => {
  const fixture = await (await request.get('http://127.0.0.1:4391/fixture')).json();
  expect(fixture.automaticPdf).toBe(true);
  await page.goto(`/admin/payments/receipts?receiptId=${fixture.receiptId}`);
  await expect(page.getByText(`Receipt #${fixture.displayId}`, { exact: true })).toBeVisible();
  await expect(page.getByText(/PDF generated/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  expect(download.suggestedFilename()).toBe(`payment-receipt-${fixture.displayId}.pdf`);
  await download.saveAs(`test-results/${info.project.name}-receipt.pdf`);
  await expect(page.getByRole('button', { name: 'Regenerate PDF' })).toBeEnabled();
  await page.getByRole('button', { name: 'Regenerate PDF' }).click();
  await expect(page.getByText('Receipt PDF regenerated.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Email receipt' }).click();
  await expect(page.getByText(/Email \(sent\)/).first()).toBeVisible();
  const after = await (await request.get('http://127.0.0.1:4391/fixture')).json();
  expect(after.captures.at(-1).attachments).toEqual([`payment-receipt-${fixture.displayId}.pdf`, 'ibogaspirit-logo.png']);
  expect(after.captures.at(-1).bodyHtml).toContain('TEST-750');
  await page.reload(); await expect(page.getByText(/Email \(sent\)/).first()).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-receipt.png`, fullPage: true });
});
test('client without email can download and record a manual WhatsApp send', async ({ page, request }) => {
  const fixture = await (await request.get('http://127.0.0.1:4391/fixture')).json();
  await page.goto(`/admin/payments/receipts?receiptId=${fixture.whatsappReceiptId}`);
  await expect(page.getByRole('button', { name: 'Email receipt' })).toBeDisabled();
  await page.getByRole('button', { name: 'Mark WhatsApp sent' }).click();
  await expect(page.getByText(/WhatsApp \(manually confirmed\)/).first()).toBeVisible();
  await page.reload(); await expect(page.getByText(/WhatsApp \(manually confirmed\)/).first()).toBeVisible();
});
test('private PDF routes reject clients and allocations from another receipt', async ({ request }) => {
  const fixture = await (await request.get('http://127.0.0.1:4391/fixture')).json();
  const endpoint = `http://127.0.0.1:4391/payments/receipts/${fixture.receiptId}/pdf?allocationId=${fixture.paymentId}`;
  expect((await request.get(endpoint)).status()).toBe(403);
  expect((await request.get(endpoint, { headers: { Authorization: 'Bearer receipt-test-client' } })).status()).toBe(403);
  expect((await request.get(`http://127.0.0.1:4391/payments/receipts/${fixture.receiptId}/pdf?allocationId=${fixture.whatsappPaymentId}`, { headers: { Authorization: 'Bearer receipt-test-staff' } })).status()).toBe(400);
  const detail = await (await request.get(`http://127.0.0.1:4391/payments/receipts/${fixture.receiptId}`, { headers: { Authorization: 'Bearer receipt-test-staff' } })).json();
  expect(detail.pdfDocuments).toBeUndefined();
});

test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus) { console.log('URL:', page.url()); console.log('BODY:', (await page.locator('body').innerText()).slice(0, 2000)); await page.screenshot({ path: 'test-results/failure-'+info.project.name+'.png' }); } });
