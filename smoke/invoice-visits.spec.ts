import { test, expect } from '@playwright/test';
const fixture = 'http://127.0.0.1:43784';
const id = '507f1f77bcf86cd799439783'; const hash = 'synthetic-invoice-783';
const headers = { Authorization: 'Bearer local-invoice-visits' };
const visitHeaders = { Origin: 'https://ibogaspirit.com', 'User-Agent': 'Mozilla/5.0 Windows Chrome/130' };
test.beforeEach(async ({ page, baseURL, request }) => {
  await request.post(fixture + '/__fixture/reset');
  await page.addInitScript(() => { localStorage.setItem('token', 'local-invoice-visits'); localStorage.setItem('user', JSON.stringify({ id:'admin',role:'admin',email:'admin@example.invalid' })); });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()); if (url.origin === new URL(baseURL!).origin) return route.continue();
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    if (path.startsWith('/invoice-visits/')) return route.fulfill({ response: await route.fetch({ url: fixture + path + url.search, headers: { ...route.request().headers(), authorization: 'Bearer local-invoice-visits' } }) });
    let data: any = [];
    if (path === `/payment-requests/${id}`) data = { _id:id,display_id:1783,invoiceNumber:'INV-1783',currency:'EUR',requestedAmount:100,status:'pending',requestType:'payment',lineItems:[] };
    if (path === '/environment/status') data = { production:true };
    if (path === '/users/navigation-permissions' || path === '/config-summary') data = {};
    if (path === '/submission-notifications/unread-count') data = {count:0};
    if (url.hostname.includes('exchangerate') || path.includes('/currency/')) data = { base:'USD',rates:{USD:1,EUR:0.9,PLN:4,CZK:22},timestamp:Date.now() };
    return route.fulfill({json:data});
  });
});

test('records a public invoice open once and displays persisted metadata below the request', async ({ page, request }) => {
  expect((await request.get(fixture+`/public/invoices/${hash}`, {headers:visitHeaders})).ok()).toBeTruthy();
  await request.get(fixture+`/public/invoices/${hash}`, {headers:visitHeaders});
  await page.goto(`/admin/payment-requests/${id}`);
  const history = page.getByRole('region', {name:'Invoice link visits'});
  await expect(history.getByText('1 recorded visit window', {exact:true})).toBeVisible();
  await expect(history.getByText(/OS: Windows/)).toBeVisible();
  await expect(history.getByText(/Notification: disabled/)).toBeVisible();
  await page.reload(); await expect(history.getByText('1 recorded visit window', {exact:true})).toBeVisible();
  expect((await (await request.get(fixture+'/__fixture/state')).json()).emails).toHaveLength(0);
});

test('saves notification configuration in Settings and queues the email to that recipient', async ({ page, request }) => {
  await page.goto(`/admin/payment-requests/${id}`);
  await page.getByLabel('Account and tools').click(); await page.getByRole('button',{name:'Currency converter',exact:true}).click();
  await page.getByRole('button',{name:'Invoice visits',exact:true}).click();
  await page.getByLabel('Invoice visit recipient email').fill('configured@example.invalid');
  await page.getByRole('checkbox',{name:'Email me when an invoice link is visited'}).check();
  await page.getByRole('button',{name:'Save invoice visit settings',exact:true}).click();
  await expect(page.getByText('Invoice visit settings saved.')).toBeVisible();
  await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  await request.get(fixture+`/public/invoices/${hash}`,{headers:visitHeaders});
  await page.getByRole('button',{name:'Refresh visits',exact:true}).click();
  await expect(page.getByText(/Notification: queued/)).toBeVisible();
  expect((await (await request.get(fixture+'/__fixture/state')).json()).emails).toEqual([{to:'configured@example.invalid',subject:'Invoice #1783 link opened'}]);
});

test('link previews are logged but do not notify, and private history/settings remain protected', async ({ request }) => {
  await request.put(fixture+'/invoice-visits/settings',{headers,data:{enabled:true,recipient:'configured@example.invalid'}});
  await request.get(fixture+`/public/invoices/${hash}`,{headers:{...visitHeaders,'User-Agent':'WhatsApp preview'}});
  const data = await (await request.get(fixture+`/invoice-visits/payment-request/${id}`,{headers})).json();
  expect(data.items[0].automated).toBe(true); expect(data.items[0].notificationStatus).toBe('skipped-bot');
  expect((await (await request.get(fixture+'/__fixture/state')).json()).emails).toHaveLength(0);
  expect((await request.get(fixture+`/invoice-visits/payment-request/${id}`)).status()).toBe(403);
  expect((await request.get(fixture+'/invoice-visits/settings',{headers:{...headers,'x-fixture-role':'medical_staff'}})).status()).toBe(403);
  expect((await request.get(fixture+'/public/invoices/invalid',{headers:visitHeaders})).status()).toBe(400);
});
