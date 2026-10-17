import { expect, test } from '@playwright/test';

const id = '507f1f77bcf86cd799439852';
const client = { _id: '507f1f77bcf86cd799439851', display_id: 1852, firstName: 'Synthetic', lastName: 'Review', email: 'review@example.invalid' };
const review = { _id: id, display_id: 2852, clientId: client, status: 'rejected', requestType: 'ekg_review', artifactIds: [] };
for (const [reason, explanation] of [
  ['no_client_email', 'this client has no email address on file'],
  ['decision_type_disabled', 'client emails for this decision type are turned off'],
  ['master_switch_disabled', 'client medical-review emails are turned off for all decisions'],
]) {
  test(`MRR history explains ${reason} and retains saved emails after reload`, async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'synthetic-review');
      localStorage.setItem('user', JSON.stringify({ id: 'fixture-admin', role: 'admin', email: 'admin@example.invalid' }));
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL!).origin) return route.continue();
      const path = url.pathname.replace(/^\/api(?=\/)/, '');
      let data: any = [];
      if (path === `/medical-review-requests/${id}`) data = review;
      if (path === '/medical-review-requests') data = [review];
      if (path.endsWith('/context')) data = { client, artifacts: { all: [] }, reviewHistory: [] };
      if (path.endsWith('/client-messages')) data = {
        messages: [{ _id: 'email-852', subject: 'Saved review update', bodyText: 'Previously sent review update.', to: [client.email], status: 'sent', createdAt: '2026-10-17T12:00:00Z' }],
        skippedNotifications: [{ decision: 'declined', reason, processedAt: '2026-10-17T13:00:00Z' }],
      };
      if (path === '/environment/status') data = { production: true };
      return route.fulfill({ json: data });
    });
    await page.goto(`/admin/medical-review-requests/${id}`);
    const history = page.getByRole('region', { name: 'Client message history' });
    await expect(history).toContainText(explanation);
    await expect(history).toContainText('Saved review update');
    await page.reload();
    await expect(history).toContainText(explanation);
    await expect(history).toContainText('Previously sent review update.');
  });
}
