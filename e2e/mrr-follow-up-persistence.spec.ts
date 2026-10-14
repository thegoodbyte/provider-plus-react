import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('follow-up persists through the real local API, MongoDB and Home', async ({ page, request, baseURL }) => {
  test.skip(process.env.PPVC791_LOCAL_E2E !== '1', 'Requires the isolated --referral-history local stack');
  test.setTimeout(120000);
  expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
  const workspace = path.resolve(__dirname, '../../..');
  const mongoose = require(path.join(workspace, 'release-20261014-referrals/api/node_modules/mongoose'));
  const credentials = JSON.parse(fs.readFileSync(path.join(workspace, 'ppvc-660-db-refresh/db-refresh-private/local-credentials.json'), 'utf8'));
  const uri = new URL(credentials.appUri);
  expect(uri.hostname).toBe('127.0.0.1'); expect(uri.port).toBe('27073'); expect(uri.pathname).toBe('/re_local');
  const api = 'http://localhost:3005';
  const login = await request.post(api + '/auth/login', { data: JSON.parse(fs.readFileSync(path.join(workspace, 'ppvc-660-db-refresh/db-refresh-private/local-admin-login.json'), 'utf8')) });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.access_token}` };
  const connection = await mongoose.createConnection(credentials.appUri).asPromise();
  const db = connection.db;
  const clientId = new mongoose.Types.ObjectId(); const mrrId = new mongoose.Types.ObjectId();
  const displayId = Date.now();
  try {
    await db.collection('clients').insertOne({ _id: clientId, display_id: displayId, firstName: 'Synthetic', lastName: 'Followup', email: `${clientId}@example.invalid`, status: 'active' });
    await db.collection('medicalreviewrequests').insertOne({ _id: mrrId, display_id: displayId, clientId, status: 'approved', requestType: 'ekg_review', artifactIds: [], followUpRequired: false, createdAt: new Date() });
    expect((await request.patch(`${api}/medical-review-requests/${mrrId}/follow-up`, { data: { followUpRequired: true } })).status()).toBe(401);
    expect((await request.patch(`${api}/medical-review-requests/${mrrId}/follow-up`, { headers, data: { followUpRequired: 'false' } })).status()).toBe(400);
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
    }, { token: session.access_token, user: session.user });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(`/admin/medical-review-requests/${mrrId}`);
    await expect(page.getByRole('heading').filter({ hasText: `ID ${displayId}` })).toBeVisible();
    await page.getByRole('button', { name: `Flag for follow-up: MRR #${displayId}` }).click();
    await expect(page.getByRole('button', { name: `Clear follow-up for MRR #${displayId}` })).toHaveAttribute('aria-pressed', 'true');
    const saved = await db.collection('medicalreviewrequests').findOne({ _id: mrrId });
    expect(saved.followUpRequired).toBe(true); expect(saved.status).toBe('approved');
    expect(saved.followUpUpdatedAt).toBeInstanceOf(Date);
    await page.reload();
    await expect(page.getByRole('button', { name: `Clear follow-up for MRR #${displayId}` })).toBeVisible();
    const tasks = await request.get(`${api}/assistant/tasks-for-today`, { headers });
    expect(tasks.ok()).toBeTruthy();
    expect((await tasks.json()).tasks.some((task: any) => task.reviewLink === `/admin/medical-review-requests/${mrrId}`)).toBe(true);
    await page.goto('/admin/launcher');
    await expect(page.getByText(`MRR #${displayId} flagged for follow-up`)).toBeVisible();
    await page.getByRole('button', { name: 'View all MRR follow-ups' }).click();
    await expect(page.getByLabel('Follow-up only')).toBeChecked();
    await page.getByRole('button', { name: `Clear follow-up for MRR #${displayId}` }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: `#${displayId}`, exact: true })).toHaveCount(0);
    expect((await db.collection('medicalreviewrequests').findOne({ _id: mrrId })).followUpRequired).toBe(false);
    const clearedTasks = await request.get(`${api}/assistant/tasks-for-today`, { headers });
    expect((await clearedTasks.json()).tasks.some((task: any) => task.reviewLink === `/admin/medical-review-requests/${mrrId}`)).toBe(false);
    expect(await db.collection('auditlogs').countDocuments({ entityId: String(mrrId), action: 'medical_review_follow_up_updated' })).toBe(2);
  } finally {
    await db.collection('medicalreviewrequests').deleteOne({ _id: mrrId });
    await db.collection('clients').deleteOne({ _id: clientId });
    await db.collection('auditlogs').deleteMany({ entityId: String(mrrId) });
    await connection.close();
  }
});
