import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
test.skip(process.env.PPVC795_LOCAL_E2E !== '1', 'Requires isolated --production-final stack');
test.describe.configure({ mode: 'serial' });
for (const width of [1440, 390]) test(`client task request, privacy and captured status email at ${width}px`, async ({ page, request, baseURL }) => {
 test.setTimeout(60000);
 expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
 const root = path.resolve(__dirname, '../../..'); const api = 'http://localhost:3005';
 const mongoose = require(path.join(root, 'release-20261014-final/api/node_modules/mongoose'));
 const credentials = JSON.parse(fs.readFileSync(path.join(root, 'ppvc-660-db-refresh/db-refresh-private/local-credentials.json'), 'utf8'));
 const uri = new URL(credentials.appUri); expect(uri.hostname).toBe('127.0.0.1'); expect(uri.port).toBe('27073'); expect(uri.pathname).toBe('/re_local');
 const connection = await mongoose.createConnection(credentials.appUri).asPromise(); const db = connection.db;
 const client = new mongoose.Types.ObjectId(), other = new mongoose.Types.ObjectId(); const marker = 'PPVC795-' + randomUUID().slice(0,8); const email = marker + '@example.invalid';
 try {
  await db.collection('clients').insertMany([{ _id: client, display_id: Date.now(), firstName: 'Synthetic', lastName: marker, email, loginPin: '795806', workflowStatus: 'active', preferredLanguage: 'en' }, { _id: other, display_id: Date.now() + 1, firstName: 'Other', email: 'other-' + email, loginPin: '795807', workflowStatus: 'active' }]);
  const adminLogin = await request.post(api + '/auth/login', { data: JSON.parse(fs.readFileSync(path.join(root, 'ppvc-660-db-refresh/db-refresh-private/local-admin-login.json'), 'utf8')) }); expect(adminLogin.ok()).toBeTruthy();
  const headers = { Authorization: 'Bearer ' + (await adminLogin.json()).access_token };
  const clientLogin = await request.post(api + '/auth/client-login', { data: { email, code: '795806' } }); expect(clientLogin.ok()).toBeTruthy(); const session = await clientLogin.json();
  const clientHeaders = { Authorization: 'Bearer ' + session.access_token };
  const created = await request.post(api + '/tasks', { headers, data: { name: marker + ' visible', description: 'Visible task', type: 'client', urgency: 'medium', clientId: String(client), sourceType: 'whatsapp' } }); expect(created.ok()).toBeTruthy(); const task = await created.json();
  expect(task).toMatchObject({ visibleToClient: true, notifyClient: true });
  await db.collection('tasks').insertMany([{ name: marker + ' private', description: 'Staff secret', notes: 'Private note', type: 'client', clientId: client, visibleToClient: false }, { name: marker + ' other', description: 'Other client secret', type: 'client', clientId: other, visibleToClient: true }]);
  expect((await request.get(api + '/client-portal/tasks')).status()).toBe(401);
  expect((await request.get(api + '/client-portal/tasks', { headers })).status()).toBe(403);
  const mine = await (await request.get(api + '/client-portal/tasks?clientId=' + other, { headers: clientHeaders })).json(); expect(mine).toHaveLength(1); expect(mine[0].notes).toBeUndefined();
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(({ token, id, email }) => { localStorage.setItem('client_auth_token', token); localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { id, email, language: 'en', name: 'Synthetic' }, token, isAuthenticated: true }, version: 0 })); }, { token: session.access_token, id: String(client), email });
  await page.route('**/*', route => /^(localhost|127\.0\.0\.1)$/.test(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.goto('http://localhost:3002/tasks');
  await expect(page.getByRole('heading', { name: 'My Tasks' })).toBeVisible(); await expect(page.getByText(marker + ' visible', { exact: true })).toBeVisible();
  await expect(page.getByText(marker + ' private', { exact: true })).toHaveCount(0); await expect(page.getByText(marker + ' other', { exact: true })).toHaveCount(0);
  const update = await request.patch(api + '/tasks/' + task._id, { headers, data: { status: 'in_progress' } }); expect(update.ok()).toBeTruthy();
  await expect.poll(async () => (await db.collection('sentemails').findOne({ relatedEntityId: task._id }))?.status).toBe('sent');
  const sent = await db.collection('sentemails').findOne({ relatedEntityId: task._id }); expect(sent.provider).toBe('development_capture'); expect(sent.bodyText).toContain('In progress');
  await page.reload(); await expect(page.getByText('In progress', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Request a task', exact: true }).click(); await page.getByLabel('Title', { exact: true }).fill(marker + ' request'); await page.getByLabel('Description', { exact: true }).fill('Please help with this synthetic request.');
  await page.getByRole('button', { name: 'Send request', exact: true }).click(); await expect(page.getByText(marker + ' request', { exact: true })).toBeVisible();
  const requested = await db.collection('tasks').findOne({ name: marker + ' request' }); expect(String(requested.clientId)).toBe(String(client)); expect(requested.sourceType).toBe('client_portal_request');
  expect((await request.post(api + '/client-portal/tasks', { headers: clientHeaders, data: { name: 'Second request', description: 'Throttled' } })).status()).toBe(429);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: path.join(root, `release-20261014-final/client-tasks-${width}.png`), fullPage: true });
 } finally {
  await db.collection('tasks').deleteMany({ clientId: { $in: [client, other] } }); await db.collection('taskrequestthrottles').deleteMany({ clientId: { $in: [String(client), String(other)] } });
  await db.collection('sentemails').deleteMany({ clientId: { $in: [client, other] } }); await db.collection('clients').deleteMany({ _id: { $in: [client, other] } }); await connection.close();
 }
});
