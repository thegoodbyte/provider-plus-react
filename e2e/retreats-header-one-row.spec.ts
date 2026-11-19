import { test, expect } from '@playwright/test';

for (const width of [1440, 768, 390]) {
  test(`retreat header layout and controls at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    let reads = 0;
    await page.route('**/*', route => {
      const request = route.request();
      if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
      const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
      if (request.method() !== 'GET') throw new Error('Display check attempted a write: ' + path);
      if (path === '/environment/status') return route.fulfill({ json: { production: true } });
      if (path === '/retreats') {
        reads++;
        return route.fulfill({ json: [
          { _id: '000000000000000000000101', name: 'Header Poland', code: 'HDR-PL', retreatCode: 'HDR-PL', location: 'Poland', status: 'upcoming', capacity: 20, startDate: '2099-05-01', endDate: '2099-05-08' },
          { _id: '000000000000000000000102', name: 'Header Czech', code: 'HDR-CZ', retreatCode: 'HDR-CZ', location: 'Czechia', status: 'upcoming', capacity: 10, startDate: '2099-06-01', endDate: '2099-06-08' },
        ] });
      }
      if (path === '/booking-flow/matrix') return route.fulfill({ json: { items: [], templates: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto('/admin/retreats');
    const header = page.locator('.retreat-register-header');
    await expect(header.getByRole('heading', { name: 'Retreats', exact: true })).toBeVisible();
    await expect(header.locator('.retreat-register-heading')).toContainText('2 upcoming');
    const search = header.getByPlaceholder('Find retreat or code');
    const status = header.locator('.retreat-register-status-select');
    await expect(search).toBeVisible();
    await expect(status).toBeVisible();
    if (width > 720) {
      const before = reads;
      await header.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect.poll(() => reads).toBeGreaterThan(before);
    } else await expect(header.getByRole('button', { name: 'Refresh', exact: true })).toBeHidden();
    await search.fill('HDR-PL');
    await expect(page.locator('.retreat-register-card')).toHaveCount(1);
    await expect(page.locator('.retreat-register-card')).toContainText('Header Poland');
    await search.fill('');
    await status.selectOption('active');
    await expect(page.locator('.retreat-register-card')).toHaveCount(0);
    await status.selectOption('all');
    await expect(page.locator('.retreat-register-card')).toHaveCount(2);
    for (const tab of ['Holistic View', 'Requirements', 'Referrals View']) {
      await header.getByRole('button', { name: tab, exact: true }).click();
      await expect(search).toHaveCount(0);
      await expect(status).toHaveCount(0);
      await expect(header.getByRole('button', { name: tab, exact: true })).toHaveClass(/is-active/);
      await header.getByRole('button', { name: 'Retreat List', exact: true }).click();
      await expect(search).toBeVisible();
    }
    await expect(header.getByRole('link', { name: 'Step Deadlines', exact: true })).toHaveAttribute('href', '/admin/booking-step-deadlines');
    await header.locator('.retreat-register-add').click();
    await expect(page.getByRole('heading', { name: 'Add New Retreat', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) {
      const boxes = await header.locator(':scope > *').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(); return { y: box.y, h: box.height };
      }));
      const centers = boxes.map(b => b.y + b.h / 2);
      expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(5);
    }
    await page.screenshot({ path: info.outputPath('retreat-header.png'), fullPage: false });
  });
}
