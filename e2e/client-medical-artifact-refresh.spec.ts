import { expect, test } from '@playwright/test';

const clientId = '507f1f77bcf86cd799439901';
const artifactId = '507f1f77bcf86cd799439902';

test.describe('PPVC-238 client medical artifact refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }));
    });
  });

  test('shows an uploaded EKG on the same Medical Info page without a legacy medical record', async ({ page }) => {
    let persistedArtifact: any = null;
    let createPayload: any = null;

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.port === '3000') return route.continue();
      if (url.pathname === '/') return route.fulfill({ json: { ok: true } });
      if (url.pathname === `/clients/${clientId}`) return route.fulfill({ json: {
        _id: clientId,
        display_id: 1501,
        firstName: 'Anna',
        lastName: 'Kowalska',
        email: 'anna@example.com',
        phone: '+420123456789',
        workflowStatus: 'potential',
      } });
      if (url.pathname === `/client-medical/client/${clientId}`) return route.fulfill({ json: null });
      if (url.pathname === `/bookings/client/${clientId}`) return route.fulfill({ json: [] });
      if (url.pathname === '/medical-artifacts' && request.method() === 'GET' && url.searchParams.get('clientId') === clientId) {
        return route.fulfill({ json: persistedArtifact ? [persistedArtifact] : [] });
      }
      if (url.pathname === '/medical-artifacts' && request.method() === 'POST') {
        createPayload = request.postDataJSON();
        return route.fulfill({ json: { ...createPayload, _id: artifactId, clientId, files: [] } });
      }
      if (url.pathname === `/medical-artifacts/${artifactId}/upload-files` && request.method() === 'POST') {
        persistedArtifact = {
          ...createPayload,
          _id: artifactId,
          display_id: 1601,
          clientId: { _id: clientId, firstName: 'Anna', lastName: 'Kowalska' },
          receivedAt: '2026-08-04T09:00:00.000Z',
          files: [{ fileName: 'entry-ekg.pdf', s3Key: `medical-artifacts/ekg/${artifactId}/entry-ekg.pdf`, mimeType: 'application/pdf', size: 4 }],
        };
        return route.fulfill({ json: { artifact: persistedArtifact, files: persistedArtifact.files, storage: 's3' } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto(`/admin/clients/${clientId}`);
    await page.getByRole('button', { name: 'Medical Info' }).click();

    await expect(page.getByText('Entry EKG Test')).toBeVisible();
    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Upload Entry EKG' }).click();
    await expect(page.getByRole('heading', { name: 'Upload EKG Files' })).toBeVisible();

    await page.locator('input[type="file"][accept="image/*,.pdf"]').first().setInputFiles({
      name: 'entry-ekg.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF'),
    });
    await page.getByRole('button', { name: 'Upload', exact: true }).click();

    await expect.poll(() => createPayload).toMatchObject({
      clientId,
      artifactType: 'ekg',
      documentType: 'EKG',
      documentStage: 'entry',
      contextType: 'client',
    });
    await expect(page.getByText('Received', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('entry-ekg.pdf').first()).toBeVisible();
    await expect(page.getByText('1 EKG document(s) uploaded')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin/clients/${clientId}$`));
  });
});
