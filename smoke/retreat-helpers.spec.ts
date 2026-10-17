import { test, expect, Page } from '@playwright/test';

async function fixture(page: Page, baseURL: string, failSave = false) {
  let retreat: any = {
    _id: '507f1f77bcf86cd799439854', code: 'F-854', name: 'Helper fixture retreat', type: 'regular',
    startDate: '2027-01-01', endDate: '2027-01-08', startTime: '18:00', endTime: '10:00', capacity: 12,
    retreatStaff: [{ role: 'helper', contactId: 'one', name: 'First Helper' }, { role: 'second_helper', contactId: 'two', name: 'Second Helper' }],
  };
  let saves = 0;
  const directory = [
    { _id: 'one', name: 'First Helper', role: 'helper', isActive: true },
    { _id: 'two', name: 'Second Helper', role: 'helper', isActive: true },
    { _id: 'three', name: 'Third Helper', role: 'helper', isActive: true },
  ];
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-helper-fixture');
    localStorage.setItem('user', JSON.stringify({ id: 'admin', role: 'admin', email: 'admin@example.invalid' }));
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    let data: any = [];
    if (path === '/environment/status') data = { production: true };
    if (path === '/users/navigation-permissions' || path === '/config-summary') data = {};
    if (path === '/submission-notifications/unread-count') data = { count: 0 };
    if (path === '/retreats') data = [retreat];
    if (path === `/retreats/${retreat._id}`) {
      if (request.method() === 'PATCH') {
        saves++;
        if (failSave) return route.fulfill({ status: 503, json: { message: 'Synthetic team save failure' } });
        retreat = { ...retreat, ...request.postDataJSON() };
      }
      data = retreat;
    }
    if (path === '/contact-book') data = url.searchParams.get('role') === 'cook' ? [] : directory;
    return route.fulfill({ json: data });
  });
  return { get retreat() { return retreat; }, get saves() { return saves; } };
}
const retreatPath = '/admin/retreats/507f1f77bcf86cd799439854';

test('add third helper from retreat, save, reload and show a separate grid column', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL!);
  await page.goto(retreatPath);
  await page.getByRole('button', { name: 'Add helper', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Staff role' })).toHaveCount(3);
  await expect(page.getByRole('combobox', { name: 'Staff role' }).nth(2)).toHaveValue('third_helper');
  await expect(page.getByLabel('From date').nth(2)).toHaveValue('2027-01-01');
  await page.getByRole('combobox', { name: 'Directory person' }).nth(2).selectOption('three');
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  await expect(page.getByText('Team saved.', { exact: true })).toBeVisible();
  expect(state.retreat.retreatStaff[2]).toMatchObject({ role: 'third_helper', contactId: 'three', name: 'Third Helper', startDate: '2027-01-01', startTime: '18:00', endDate: '2027-01-08', endTime: '10:00' });
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Directory person' })).toHaveCount(3);
  await expect(page.getByRole('combobox', { name: 'Directory person' }).nth(2)).toHaveValue('three');
  await page.goto('/admin/retreat-staffing');
  await expect(page.getByRole('columnheader', { name: 'Helper 3', exact: true })).toBeVisible();
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'F-854', exact: true }) });
  await expect(row.getByRole('cell').nth(4)).toContainText('Third Helper');
  await row.getByRole('link', { name: 'Manage team' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).nth(2).click();
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  await expect(page.getByText('Team saved.', { exact: true })).toBeVisible();
  await page.goto('/admin/retreat-staffing');
  await expect(page.getByRole('columnheader', { name: 'Helper 2', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Helper 3', exact: true })).toHaveCount(0);
});

test('empty helper cannot be saved and failed saves retain the draft', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL!, true);
  await page.goto(`${retreatPath}/helpers?add=helper`);
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  await expect(page.getByText('Select a directory person for each assignment, or remove the empty row.')).toBeVisible();
  expect(state.saves).toBe(0);
  await page.getByRole('combobox', { name: 'Directory person' }).nth(2).selectOption('three');
  await page.getByRole('button', { name: 'Save team', exact: true }).click();
  await expect(page.getByText('Synthetic team save failure', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Directory person' }).nth(2)).toHaveValue('three');
  expect(state.saves).toBe(1);
  expect(state.retreat.retreatStaff).toHaveLength(2);
});
