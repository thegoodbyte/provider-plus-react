import { test, expect } from '@playwright/test';
for (const width of [1440, 390]) for (const scenario of ['unpopulated', 'populated', 'missing']) test(`MRR identity ${scenario} at ${width}px`, async ({ page }) => {
  const clientHash = '6ab051d2ae5432b71f7a365', requestHash = '6ab051d2ae5432b71f7a364';
  const client = { _id: clientHash, firstName: 'Aleksandra Maria', lastName: 'Nowak-Kowalska', display_id: 1265 };
  const item = { _id: requestHash, display_id: scenario === 'missing' ? undefined : 1413, clientId: scenario === 'populated' ? client : clientHash, status: 'pending', requestType: 'medications_review', documentType: 'Medications', documentStage: 'entry', artifactIds: [] };
  await page.setViewportSize({ width, height: 980 });
  await page.addInitScript(() => { localStorage.setItem('token', 'synthetic-local-only'); localStorage.setItem('user', JSON.stringify({ id: 'staff', role: 'admin', email: 'staff@example.invalid' })); });
  await page.route('**/*', async route => {
    const req = route.request(); if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
    const path = new URL(req.url()).pathname;
    if (path === '/medical-review-requests') return route.fulfill({ json: [item] });
    if (path.endsWith('/context')) return route.fulfill({ json: { client: scenario === 'unpopulated' ? client : undefined, artifacts: { all: [] }, reviewHistory: [] } });
    if (path.endsWith('/client-messages')) return route.fulfill({ json: { messages: [], skippedNotifications: [] } });
    if (path === '/environment/status') return route.fulfill({ json: { environment: 'local', production: false, enabledJobs: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/admin/medical-review-requests/' + requestHash);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toContainText(scenario === 'missing' ? 'MRR number not assigned' : 'MRR #1413');
  const identity = page.getByRole('region', { name: 'Review identity' });
  await expect(identity).toBeVisible();
  await expect(identity).toContainText(scenario === 'missing' ? 'Client name unavailable' : 'Aleksandra Maria Nowak-Kowalska');
  await expect(identity).toContainText(scenario === 'missing' ? 'Client ID unavailable' : 'Client ID: 1265');
  // Document type is a separate badge in the redesigned header.
  await expect(page.getByText('Medications', { exact: true }).first()).toBeVisible();
  await expect(identity).not.toContainText(clientHash);
  await expect(heading).not.toContainText(requestHash);
  if (scenario !== 'missing') await expect(identity.getByRole('link')).toHaveAttribute('href', '/admin/medical/' + clientHash);
  const bounds = await identity.boundingBox(); expect(bounds).toBeTruthy(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  await heading.locator('..').screenshot({ path: `../mrr-identity-screenshots/${scenario}-${width}.png` });
});
