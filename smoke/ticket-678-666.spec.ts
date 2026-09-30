import { test, expect } from '@playwright/test';
const clientId = '507f1f77bcf86cd799439901';
const artifactId = '507f1f77bcf86cd799439902';
const liverId = '507f1f77bcf86cd799439903';
const reviewId = '507f1f77bcf86cd799439904';
test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'local-ui-test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'test-admin', email: 'admin@example.invalid', role: 'admin' }));
  });
  let settings = { enabled: false, recipients: ['ops@example.invalid'], areas: ['submissions', 'medicalReviews'], upcomingDays: 60, lastRun: null };
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin && !url.pathname.startsWith('/api/')) return route.continue();
    const path = url.pathname.replace(/^\/api/, '');
    if (path === `/clients/${clientId}`) return route.fulfill({ json: { _id: clientId, display_id: 1501, firstName: 'Development', lastName: 'Client', email: 'client@example.invalid', phone: '', workflowStatus: 'entered' } });
    if (path === `/client-medical/client/${clientId}`) return route.fulfill({ json: null });
    if (path === '/medical-artifacts') return route.fulfill({ json: [
      { _id: artifactId, clientId, artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', title: 'Entry EKG', status: 'pending_review', receivedAt: '2026-09-29', files: [{ fileName: 'synthetic-ekg.pdf', mimeType: 'application/pdf' }] },
      { _id: liverId, clientId, artifactType: 'liver_panel', documentType: 'Liver', documentStage: 'entry', title: 'Entry liver', status: 'stored', receivedAt: '2026-09-29', files: [{ fileName: 'synthetic-liver.pdf', mimeType: 'application/pdf' }] },
    ] });
    if (path === '/medical-review-requests/by-artifacts') return route.fulfill({ json: [{ _id: reviewId, display_id: 1005, artifactIds: [artifactId], status: 'in_review' }] });
    if (path === '/morning-digest/settings') {
      if (route.request().method() === 'PUT') settings = { ...settings, ...route.request().postDataJSON() };
      return route.fulfill({ json: settings });
    }
    if (path === '/morning-digest/preview') return route.fulfill({ json: { sections: [{ key: 'medicalReviews', title: 'Pending medical review requests', count: 1, items: ['MRR #1005 · in_review'] }] } });
    if (path === '/assistant/tasks-for-today') return route.fulfill({ json: { tasks: [], retreats: [] } });
    if (path === '/launcher-config') return route.fulfill({ json: { assignments: [] } });
    if (path === '/communications/email-safety') return route.fulfill({ json: { enabled: true, recipient: 'test@example.invalid' } });
    if (url.hostname.includes('exchangerate') || url.hostname.includes('fxrates')) return route.fulfill({ json: { rates: { EUR: 0.9, USD: 1, CZK: 22, PLN: 4 }, time_last_updated: 1790640000 } });
    if (path === '/config-summary') return route.fulfill({ json: {} });
    return route.fulfill({ json: [] });
  });
});
test('client medical view shows linked MRR status and the missing liver review action', async ({ page }) => {
  await page.goto(`/admin/clients/${clientId}`);
  await page.getByRole('button', { name: 'Medical Info', exact: true }).click();
  await expect(page.getByRole('link', { name: 'MRR #1005' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'MRR #1005' }).first()).toHaveAttribute('href', `/admin/medical-review-requests/${reviewId}`);
  await expect(page.getByText('in review', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create MRR' }).first()).toHaveAttribute('href', `/admin/medical-review-requests/new?artifactId=${liverId}`);
  await page.getByRole('link', { name: 'MRR #1005' }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/ppvc-678-medical.png', fullPage: true });
});
test('morning digest is reachable in Settings, saves, and previews without sending', async ({ page }) => {
  const sends: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /send|process/.test(request.url())) sends.push(request.url()); });
  await page.goto(`/admin/clients/${clientId}`);
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('button', { name: 'Morning digest', exact: true }).click();
  await page.getByLabel('Enable daily digest').check();
  await page.getByLabel('Recipients', { exact: true }).fill('ops@example.invalid, second@example.invalid');
  await page.getByRole('button', { name: 'Save digest settings' }).click();
  await expect(page.getByText('Morning digest settings saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Preview saved settings' }).click();
  await expect(page.getByText('MRR #1005 · in_review', { exact: true })).toBeVisible();
  expect(sends).toEqual([]);
  await page.screenshot({ path: 'test-results/ppvc-666-settings.png', fullPage: true });
});
