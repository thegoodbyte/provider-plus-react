import { expect, test } from '@playwright/test';

const id = '507f1f77bcf86cd799439011';
const reviewUrl = 'https://example.invalid/medical-reviews/mrr-1539/synthetic-token';

for (const width of [1440, 390]) {
  test(`admin can find and explicitly generate the advisor link at ${width}px`, async ({ page, context }, info) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width, height: 1000 });
    const writes: string[] = [];
    let generated = false;
    await page.route('**/*', async route => {
      const request = route.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
      const path = new URL(request.url()).pathname;
      if (request.method() !== 'GET') {
        writes.push(request.method() + ' ' + path);
        if (path === `/medical-review-requests/${id}/access-links`) {
          generated = true;
          return route.fulfill({ status: 201, json: { url: reviewUrl } });
        }
        return route.fulfill({ status: 405, json: {} });
      }
      if (path === '/medical-review-requests') return route.fulfill({
        json: [{ _id: id, display_id: 1539, requestType: 'ekg_review', status: 'pending', artifactIds: [] }],
      });
      if (path.endsWith('/context')) return route.fulfill({ json: { artifacts: { all: [] } } });
      if (path.endsWith('/access-links')) return route.fulfill({ json: [] });
      if (path.endsWith('/client-messages')) return route.fulfill({ json: { messages: [] } });
      return route.fulfill({ json: [] });
    });

    await page.goto('/admin/medical-review-requests/' + id);
    await expect(page.getByRole('button', { name: 'Download MRR #1539 for WhatsApp' })).toBeVisible();
    const open = page.getByRole('button', { name: 'Advisor review link', exact: true });
    await expect(open).toBeVisible();
    const generate = page.getByRole('button', { name: 'Generate advisor link' });
    await expect(generate).toBeHidden();
    await open.click();
    await expect(generate).toBeVisible();
    await expect(page.locator('#mrr-advisor-access summary')).toBeFocused();
    expect(writes).toEqual([]);
    await generate.click();
    await expect(page.getByRole('link', { name: 'Share via WhatsApp' })).toHaveAttribute(
      'href', `https://wa.me/?text=${encodeURIComponent(`Medical review link: ${reviewUrl}`)}`,
    );
    await page.getByRole('button', { name: 'Copy for WhatsApp' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(reviewUrl);
    expect(generated).toBe(true);
    expect(writes).toEqual([`POST /medical-review-requests/${id}/access-links`]);
    await page.locator('#mrr-advisor-access').screenshot({ path: info.outputPath('advisor-link.png') });
    await page.unrouteAll({ behavior: 'wait' });
  });
}
