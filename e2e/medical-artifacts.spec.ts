import { test, expect } from '@playwright/test';

const testArtifact = {
  _id: 'artifact-1',
  display_id: 1042,
  artifactType: 'ekg',
  title: 'Entry EKG',
  description: 'Initial EKG upload',
  notes: 'Original admin note',
  status: 'stored',
  source: 'admin_upload',
  version: 1,
  receivedAt: '2026-05-25T10:00:00.000Z',
  clientId: {
    _id: 'client-1',
    display_id: 1001,
    firstName: 'Test',
    lastName: 'Client',
    email: 'test@example.com',
  },
  files: [
    {
      fileName: 'entry-ekg.pdf',
      s3Key: 'medical-artifacts/ekg/artifact-1/20260525_entry-ekg.pdf',
      mimeType: 'application/pdf',
      size: 204800,
      uploadedAt: '2026-05-25T10:01:00.000Z',
    },
  ],
};

test.describe('Medical Artifacts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'test-token');
      window.localStorage.setItem('user', JSON.stringify({
        username: 'admin@example.com',
        email: 'admin@example.com',
        role: 'admin',
      }));
    });

    await page.route('**/', async (route) => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    await page.route('**/medical-artifacts/artifact-1', async (route) => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }

      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...testArtifact, ...body }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testArtifact),
      });
    });

    await page.route('**/medical-artifacts', async (route) => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([testArtifact]),
      });
    });
  });

  test('opens the detail view from the artifact list and saves admin notes', async ({ page }) => {
    await page.goto('/admin/medical-artifacts');

    await expect(page.getByRole('heading', { name: 'Medical Artifacts' })).toBeVisible();
    await expect(page.getByText('Entry EKG')).toBeVisible();
    await expect(page.getByText('#1042')).toBeVisible();

    await page.getByRole('button', { name: /View\/Edit/i }).click();

    await expect(page).toHaveURL(/\/admin\/medical-artifacts\/artifact-1$/);
    await expect(page.getByRole('heading', { name: /Medical Artifact #1042/i })).toBeVisible();
    await expect(page.getByText('medical-artifacts/ekg/artifact-1/20260525_entry-ekg.pdf')).toBeVisible();

    await page.getByLabel('Admin notes').fill('Reviewed storage path and ready for provider review.');
    await page.getByRole('button', { name: /Save Changes/i }).click();

    await expect(page.getByLabel('Admin notes')).toHaveValue('Reviewed storage path and ready for provider review.');
  });
});
