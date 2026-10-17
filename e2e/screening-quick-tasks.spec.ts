import { test, expect, Page } from '@playwright/test';

// PPVC-20: a way to add quick tasks while screening a client, without
// leaving the screening page.

const clientId = '507f1f77bcf86cd799439030';
const client = { _id: clientId, firstName: 'Lukas', lastName: 'Horak', display_id: 888, email: 'lukas@example.test', screeningData: {} };

async function mockApi(page: Page) {
  let createdTask: any = null;
  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-token');
    localStorage.setItem('user', JSON.stringify({ id: 'admin', role: 'admin', email: 'admin@example.test' }));
  });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    let data: any = [];
    if (path === `/clients/${clientId}`) data = client;
    if (path === '/clients') data = [client];
    if (path === '/referrals') data = [];
    if (path === '/room-inventory/options') data = [];
    if (path.startsWith('/room-inventory/preference/')) data = null;
    if (path === '/tasks') {
      if (request.method() === 'POST') {
        createdTask = request.postDataJSON();
        data = { id: 'task-1', ...createdTask, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      } else {
        expect(url.searchParams.get('clientId')).toBe(clientId);
        data = createdTask ? [{ id: 'task-1', ...createdTask, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] : [];
      }
    }
    if (path === '/users/navigation-permissions' || path.includes('config-summary')) data = {};
    if (path === '/submission-notifications/unread-count') data = { count: 0 };
    if (path === '/environment/status') data = { production: true };
    return route.fulfill({ json: data });
  });
}

test('PPVC-20: adds a quick task while screening a client, without leaving the page', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/admin/clients/${clientId}/screening`);
  await expect(page.locator('input[value="Lukas"]')).toBeVisible();
  await expect(page.getByText(/Quick Tasks/)).toBeVisible();
  await expect(page.getByText('No tasks found.')).toBeVisible();

  await page.getByRole('button', { name: /Add Task/ }).click();
  await page.getByLabel('Task Name *').fill('Follow up on blood pressure reading');
  await page.getByLabel('Description (optional)').fill('Confirm the reading before the retreat.');
  await page.getByRole('button', { name: 'Create Task' }).click();

  await expect(page.getByText('Follow up on blood pressure reading')).toBeVisible();
  // Saving the task must not navigate away from the screening form.
  await expect(page.locator('input[value="Lukas"]')).toBeVisible();
});
