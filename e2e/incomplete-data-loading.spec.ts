import { expect, test, Page } from '@playwright/test';

// Exercise real routes and API adapters with deterministic HTTP failures; no live data is modified.
const retreat = { _id: 'r1', name: 'Loading Test Retreat', status: 'upcoming', startDate: '2030-10-01' };
const booking = { _id: 'b1', retreatId: 'r1', clientId: { _id: 'c1', firstName: 'Anna', lastName: 'Loading', email: 'anna@example.test' } };
const attentionPaths = ['/booking-flow/items', '/booking-documents', '/payment-requests', '/medical-review-requests', '/reminders'];

async function mockApi(page: Page, failures: Set<string>) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-token');
    localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.test', role: 'admin' }));
  });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
    if (failures.has(path)) return route.fulfill({ status: 503, json: { message: 'Test service unavailable' } });
    let data: any = [];
    if (path === '/retreats') data = [retreat];
    if (path === '/booking-flow/retreats/r1/workflow-summary') {
      if (failures.has('/bookings/retreat/r1/with-details')) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
      const unavailable = [
        ['/payments/by-client-and-retreat', 'Payments'],
        ['/medical-artifacts', 'Medical documents / reviews'],
        ['/medical-review-requests', 'Medical reviews'],
        ['/client-requirements/client/c1/retreat/r1', 'Requirements'],
        ['/reminders/retreat/r1', 'Reminders'],
      ].filter(([endpoint]) => failures.has(endpoint)).map(([, label]) => label);
      data = { unavailable, rows: [{ ...booking, clientName: 'Anna Loading', clientEmail: 'anna@example.test', depositPaid: true,
        medicalRequirements: ['ekg', 'liver_panel'].map(type => ({ type, label: type === 'ekg' ? 'EKG' : 'Liver Panel', state: unavailable.some(label => label.startsWith('Medical')) ? 'unavailable' : 'approved' })),
        reminders: [], readinessScore: 4, readinessState: unavailable.length ? 'unknown' : 'ready', nextAction: unavailable.length ? 'Retry unavailable data' : 'Ready for retreat', missingItems: [], unavailable,
      }] };
    }

    if (path === '/bookings/retreat/r1/with-details') data = [booking];
    if (path === '/medical-artifacts') data = ['ekg', 'liver_panel'].map(type => ({ _id: type, artifactType: type, files: [{ fileName: `${type}.pdf` }] }));
    if (path === '/medical-review-requests') data = [{ _id: 'review1', status: 'approved' }];
    if (path === '/payments/by-client-and-retreat') data = [{ _id: 'p1', status: 'completed', isDeposit: true, amount: 100, currency: 'EUR', paymentMethod: 'bank_transfer' }];
    if (path.startsWith('/client-medical/')) data = {};
    if (path === '/booking-flow/items') data = [{ _id: 's1', bookingId: 'b1', title: 'Upload agreement', status: 'pending', clientId: booking.clientId }];
    if (path === '/users/navigation-permissions') data = {};
    return route.fulfill({ json: data });
  });
}

for (const [label, path, tab] of [
  ['payments', '/payments/by-client-and-retreat', 'payments'],
  ['medical artifacts', '/medical-artifacts', 'medical'],
  ['medical reviews', '/medical-review-requests', 'medical'],
  ['requirements', '/client-requirements/client/c1/retreat/r1', 'requirements'],
  ['reminders', '/reminders/retreat/r1', 'messages'],
] as const) {
  test(`workflow reports unavailable ${label} and recovers without navigation`, async ({ page }) => {
    const failures = new Set([path]);
    await mockApi(page, failures);
    await page.goto('/admin/workflow');
    const dashboard = page.locator('.workflow-dashboard');
    await expect(dashboard.getByRole('alert')).toContainText('Readiness and counts are incomplete');
    await expect(dashboard.getByRole('status')).toContainText('Readiness unknown');
    await expect(page.locator('.api-error-overlay')).toHaveCount(0);
    await expect(dashboard.getByText('Deposit due', { exact: true })).toHaveCount(0);
    await dashboard.getByRole('button', { name: tab, exact: true }).click();
    await expect(dashboard.getByText(/Unable to load/).first()).toBeVisible();
    await expect(dashboard.getByText('Missing file', { exact: true })).toHaveCount(0);
    await expect(dashboard.getByText('No payments recorded for this booking.')).toHaveCount(0);
    failures.clear();
    await dashboard.getByRole('button', { name: 'Retry unavailable data' }).click();
    await expect(dashboard.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
    await expect(dashboard.getByRole('alert')).toHaveCount(0);
    await expect(dashboard.getByText('Deposit paid', { exact: true })).toBeVisible();
    await dashboard.getByRole('button', { name: 'overview', exact: true }).click();
    await expect(dashboard.getByText('4/4 checkpoints complete')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/workflow$/);
  });
}

test('attention queue preserves available work and filters while retrying a failed category', async ({ page }) => {
  const failures = new Set(['/payment-requests']);
  await mockApi(page, failures);
  await page.goto('/admin/needs-attention');
  await expect(page.getByRole('alert')).toContainText('Payments');
  await expect(page.locator('.needs-attention-desktop-table').getByText('Upload agreement', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill('agreement');
  failures.clear();
  await page.getByRole('button', { name: 'Retry unavailable data' }).click();
  await expect(page.locator('.needs-attention-desktop-table').getByText('Upload agreement', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('agreement');
});

test('attention queue total failure is not an empty queue and can be retried', async ({ page }) => {
  const failures = new Set(attentionPaths);
  await mockApi(page, failures);
  await page.goto('/admin/needs-attention');
  await expect(page.getByRole('alert')).toContainText('Booking steps / Contracts, Documents / Contracts, Payments, Medical reviews, Follow-ups');
  await expect(page.getByText('No open items match the current filters.')).toHaveCount(0);
  failures.clear();
  await page.getByRole('button', { name: 'Retry unavailable data' }).click();
  await expect(page.locator('.needs-attention-desktop-table').getByText('Upload agreement', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('attention queue uses meaningful actions and stays usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page, new Set());
  await page.goto('/admin/needs-attention');

  await expect(page.locator('.needs-attention-mobile-list').getByRole('button', { name: 'Review booking step for Anna Loading' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open' })).toHaveCount(0);
  await expect(page.getByText('Due soon', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('textbox', { name: 'Search', exact: true }).fill('agreement');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('agreement');
  await expect(page.locator('.needs-attention-mobile-list').getByRole('button', { name: 'Review booking step for Anna Loading' })).toBeVisible();
});

test('workflow initial failure offers a working retry instead of empty bookings', async ({ page }) => {
  const failures = new Set(['/retreats']);
  await mockApi(page, failures);
  await page.goto('/admin/workflow');
  await expect(page.locator('.workflow-dashboard').getByRole('alert')).toContainText('Retreats');
  await expect(page.getByText('No bookings found for this retreat.')).toHaveCount(0);
  failures.clear();
  await page.getByRole('button', { name: 'Retry unavailable data' }).click();
  await expect(page.getByText('4/4 checkpoints complete')).toBeVisible();
});

test('workflow refresh failure replaces previously confirmed readiness', async ({ page }) => {
  const failures = new Set<string>();
  await mockApi(page, failures);
  await page.goto('/admin/workflow');
  const dashboard = page.locator('.workflow-dashboard');
  await expect(dashboard.getByText('4/4 checkpoints complete')).toBeVisible();
  failures.add('/payments/by-client-and-retreat');
  await dashboard.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(dashboard.getByRole('status')).toContainText('Readiness unknown');
  await expect(dashboard.getByText('Deposit paid', { exact: true })).toHaveCount(0);
  await expect(dashboard.getByText('4/4 checkpoints complete')).toHaveCount(0);
  await expect(page.locator('.api-error-overlay')).toHaveCount(0);
});

test('failed booking list is not presented as zero bookings', async ({ page }) => {
  const failures = new Set(['/bookings/retreat/r1/with-details']);
  await mockApi(page, failures);
  await page.goto('/admin/workflow');
  const dashboard = page.locator('.workflow-dashboard');
  await expect(dashboard.getByRole('alert')).toContainText('Workflow data');
  await expect(dashboard.locator('.workflow-stat-grid')).toHaveCount(0);
  await expect(dashboard.getByText('No bookings found for this retreat.')).toHaveCount(0);
  failures.clear();
  await dashboard.getByRole('button', { name: 'Retry unavailable data' }).click();
  await expect(dashboard.getByText('4/4 checkpoints complete')).toBeVisible();
});
