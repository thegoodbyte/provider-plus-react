import { expect, test } from '@playwright/test';

const booking = '507f1f77bcf86cd799439011';
const artifacts = [
  { _id: 'new-ekg', display_id: 101, artifactType: 'ekg', receivedAt: '2026-11-25' },
  { _id: 'new-liver', display_id: 102, artifactType: 'liver_panel', receivedAt: '2026-11-26' },
  { _id: 'old-ekg', display_id: 103, artifactType: 'ekg', receivedAt: '2026-10-02' },
  { _id: 'old-liver', display_id: 104, artifactType: 'liver_panel', receivedAt: '2026-10-02' },
].map(artifact => ({ ...artifact, bookingId: booking, documentStage: 'entry', files: [{ fileName: 'synthetic.pdf' }] }));

for (const width of [1440, 390]) {
  test(`booking shows current uploads and earlier MRR links at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    let releaseArtifacts = () => {};
    const holdArtifacts = new Promise<void>(resolve => { releaseArtifacts = resolve; });
    const writes: string[] = [];
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
      const { pathname } = new URL(request.url());
      if (request.method() !== 'GET') {
        writes.push(pathname);
        return route.fulfill({ status: 405, json: {} });
      }
      if (pathname === '/bookings/' + booking) return route.fulfill({
        json: { _id: booking, bookingNumber: 123, status: 'confirmed', clientId: { _id: 'client', firstName: 'Synthetic' }, retreatId: { _id: 'retreat', name: 'Synthetic retreat' } },
      });
      if (pathname === '/medical-artifacts/booking/' + booking) {
        await holdArtifacts;
        return route.fulfill({ json: artifacts });
      }
      if (pathname === '/medical-review-requests/by-artifacts') return route.fulfill({
        json: [
          { _id: 'earlier-ekg-review', display_id: 201, artifactIds: ['old-ekg'], status: 'approved', reviewDecision: 'OK' },
          { _id: 'earlier-liver-review', display_id: 202, artifactIds: ['old-liver'], status: 'approved', reviewDecision: 'OK' },
        ],
      });
      return route.fulfill({ json: [] });
    });

    try {
      await page.goto('/admin/bookings/' + booking);
      await page.getByRole('tab', { name: 'Medical', exact: true }).click();
      await expect(page.getByText('Loading medical records…')).toBeVisible();
      await expect(page.getByText('Not received', { exact: true })).toHaveCount(0);
    } finally {
      releaseArtifacts();
    }
    await expect(page.getByText('2 of 2 entry items received · 0 of 2 decided')).toBeVisible();
    for (const [title, current, prior, mrr] of [
      ['Entry EKG', 101, 103, 201],
      ['Entry liver panel', 102, 104, 202],
    ]) {
      const card = page.locator('article.medical-item-card').filter({ hasText: title as string });
      await expect(card).toHaveAttribute('data-state', 'received');
      await expect(card.getByText(`Artifact #${current}`, { exact: true })).toBeVisible();
      await expect(card.getByText(`Earlier review · Artifact #${prior}`)).toBeVisible();
      await expect(card.getByRole('button', { name: `MRR #${mrr}` })).toBeVisible();
    }
    await page.locator('.booking-medical-required-grid').screenshot({ path: info.outputPath('medical-summary.png') });
    expect(writes).toEqual([]);
    await page.unrouteAll({ behavior: 'wait' });
  });
}
