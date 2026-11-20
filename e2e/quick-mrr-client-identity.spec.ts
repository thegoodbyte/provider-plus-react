import { test, expect } from './fixtures/client-workspace';
import { medicalWorkspace } from './fixtures/medical-workspace';

for (const width of [1440, 390]) test(`Quick MRR identifies the selected client from list and detail at ${width}px`, async ({ page, clientWorkspace: f }, info) => {
  const medical = await medicalWorkspace(f);
  try {
    const clients = await f.models.Client.find({ _id: { $in: [f.ids.client, f.ids.sibling] } }).sort({ display_id: 1 }).lean();
    const artifacts = await f.models.MedicalArtifact.create(clients.map((client: any, i: number) => ({
      clientId: client._id, display_id: 1567 + i, title: `Synthetic client EKG ${i + 1}`,
      artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', contextType: 'client',
      status: 'stored', source: 'admin_upload', files: [],
    })));
    const snapshot = async () => JSON.stringify({ artifacts: await f.models.MedicalArtifact.find().sort({ _id: 1 }).lean(), reviews: await f.models.MedicalReviewRequest.find().lean() });
    const before = await snapshot();
    let writes = 0;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/*', async route => {
      const request = route.request(), u = new URL(request.url());
      if (!['xhr', 'fetch'].includes(request.resourceType())) return route.fallback();
      if (request.method() !== 'GET') { writes++; return route.abort(); }
      if (u.pathname.startsWith('/medical-artifacts')) return route.fulfill({ response: await route.fetch({ url: medical.url + u.pathname + u.search }) });
      return route.fallback();
    });
    for (const entry of ['list', 'detail']) {
      if (entry === 'list') {
        await page.goto('/admin/medical-artifacts');
        await page.getByRole('button', { name: 'Future retreats', exact: true }).click();
      }
      for (let i = 0; i < 2; i++) {
        if (entry === 'list') await page.getByRole('button', { name: `Quick MRR for artifact #${1567 + i}`, exact: true }).click();
        else {
          await page.goto('/admin/medical-artifacts/' + artifacts[i]._id);
          await page.getByRole('button', { name: 'Quick MRR', exact: true }).click();
        }
        const dialog = page.getByRole('dialog');
        const identity = dialog.getByLabel('Client for this review');
        await expect(identity).toHaveText(`${clients[i].firstName} ${clients[i].lastName}Client #${clients[i].display_id}`);
        await expect(identity).not.toContainText(`Client #${clients[1-i].display_id}`);
        await expect(dialog.getByRole('checkbox', { name: /Notify client/ })).toBeChecked();
        expect(await identity.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await dialog.screenshot({ path: info.outputPath(`quick-mrr-${entry}-${i}-${width}.png`), animations: 'disabled' });
        const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
        await cancel.scrollIntoViewIfNeeded();
        await expect(cancel).toBeVisible();
        await cancel.click();
        await expect(dialog).toHaveCount(0);
      }
    }
    expect(writes).toBe(0);
    expect(await snapshot()).toBe(before);
    expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    medical.app.getHttpServer().closeAllConnections?.();
    await medical.close();
  }
});
