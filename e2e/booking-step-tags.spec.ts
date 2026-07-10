import { test, expect } from '@playwright/test';

const templateId = 'template-1';
const retreatId = 'retreat-1';

const template = {
  _id: templateId,
  workflowStage: 'medical',
  key: 'ekg_received',
  title: 'Entry EKG received',
  description: 'Marks the EKG step complete and tags the client.',
  category: 'medical',
  offsetDays: 21,
  latestDaysBeforeRetreat: 14,
  deadlineBasis: 'after_booking',
  active: true,
  isBlocking: true,
  order: 60,
  createsTask: true,
  reviewRequired: false,
  isRequirement: true,
  requirementType: 'entry_ekg',
  taskTitle: 'Check EKG received',
  taskPriority: 'high',
  readinessGroup: 'ekg',
  readinessGroupColor: '#dbeafe',
  expectedArtifact: 'ekg',
  expectedDocumentStage: 'entry',
  expectedDocumentType: 'EKG',
  expectedArtifactPurpose: 'booking_requirement',
  clientTagOnComplete: 'medically-approved',
  autoCompleteOnArtifact: true,
  autoCompleteStatus: 'received',
  emailEnabled: false,
  emailTemplateId: '',
  actions: [],
};

test.describe('Booking step tag configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 'admin-e2e',
        email: 'admin@example.com',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
      }));
    });
  });

  test('shows and saves client tag on complete in booking step setup', async ({ page }) => {
    let patchPayload: any = null;
    const templates = [template];

    await page.route('**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (url.port === '3000') {
        await route.continue();
        return;
      }

      if (url.pathname === '/') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }

      if (url.pathname === '/booking-flow/library/templates' && request.method() === 'GET') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(templates) });
        return;
      }

      if (url.pathname === `/booking-flow/library/templates/${templateId}` && request.method() === 'PATCH') {
        patchPayload = request.postDataJSON();
        templates[0] = { ...templates[0], ...patchPayload };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(templates[0]) });
        return;
      }

      if (url.pathname === '/retreats') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              _id: retreatId,
              name: 'JNO Summer Retreat',
              code: 'JNO-07-25-26',
              location_town: 'Benecko',
            },
          ]),
        });
        return;
      }

      if (url.pathname === '/communications/templates') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/admin/retreat-flow-library');
    await expect(page.getByRole('heading', { name: /Booking Step Setup/i })).toBeVisible();
    await expect(page.getByLabel('Client tag on complete')).toHaveValue('medically-approved');

    await page.getByLabel('Client tag on complete').fill('medical-approved');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => patchPayload?.clientTagOnComplete).toBe('medical-approved');
    await expect(page.getByLabel('Client tag on complete')).toHaveValue('medical-approved');
  });
});
