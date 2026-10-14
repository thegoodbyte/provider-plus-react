import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

for (const width of [1440, 390, 320]) {
  test(`numeric MRR identity, saved follow-up and compact client actions at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const client = { _id: '507f1f77bcf86cd799439041', display_id: 1201, firstName: 'Dana', lastName: 'Babicova', email: 'synthetic@example.invalid', status: 'active' };
    const mrr = { _id: '507f1f77bcf86cd799439042', display_id: 7931, clientId: client, status: 'approved', requestType: 'ekg_review', artifactIds: [], followUpRequired: false };
    const other = { ...mrr, _id: '507f1f77bcf86cd799439043', display_id: 7932 };
    let failFlag = false;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL!).origin) return route.continue();
      const json = (value: unknown, status = 200) => route.fulfill({ json: value, status });
      if (url.pathname === '/environment/status') return json({ environment: 'development', production: false, enabledJobs: [] });
      if (url.pathname === '/medical-review-requests') return json([mrr, other]);
      if (url.pathname === `/medical-review-requests/${mrr._id}/context`) return json({ client, artifacts: { all: [] }, reviewHistory: [] });
      if (url.pathname === `/medical-review-requests/${mrr._id}/follow-up`) {
        if (failFlag) return json({ message: 'Temporary flag failure' }, 503);
        const body = route.request().postDataJSON();
        mrr.followUpRequired = body.followUpRequired;
        return json({ _id: mrr._id, followUpRequired: mrr.followUpRequired });
      }
      if (url.pathname === `/medical-review-requests/${mrr._id}`) return json(mrr);
      if (url.pathname === '/clients') return json([client]);
      if (url.pathname === `/clients/${client._id}`) return json(client);
      if (url.pathname === '/assistant/tasks-for-today') return json({ retreats: [], tasks: mrr.followUpRequired ? [{ severity: 'high', category: 'review', clientName: 'Dana Babicova', bookingLink: `/admin/medical-review-requests/${mrr._id}`, reviewLink: `/admin/medical-review-requests/${mrr._id}`, message: 'MRR #7931 flagged for follow-up', retreatId: '' }] : [] });
      return json([]);
    });
    const output = path.resolve(__dirname, '../../../ppvc-793-791-768-validation');
    fs.mkdirSync(output, { recursive: true });
    await page.goto(`/admin/medical-review-requests/${mrr._id}`);
    const identity = width >= 640 ? page.getByText('ID: 1201', { exact: true }) : page.getByRole('heading').filter({ hasText: 'ID 1201' });
    await expect(identity).toBeVisible();
    await expect(page.getByText(`ID: ${client._id}`, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(output, `mrr-${width}.png`) });
    const flag = page.getByRole('button', { name: 'Flag for follow-up: MRR #7931' });
    failFlag = true;
    await flag.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Temporary flag failure' })).toBeVisible();
    await expect(flag).toHaveAttribute('aria-pressed', 'false');
    failFlag = false;
    await flag.click();
    await expect(page.getByRole('button', { name: 'Clear follow-up for MRR #7931' })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Clear follow-up for MRR #7931' })).toBeVisible();
    await page.goto('/admin/launcher');
    await expect(page.getByText('MRR #7931 flagged for follow-up')).toBeVisible();
    await page.getByRole('button', { name: 'Dana Babicova', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${mrr._id}$`));
    await page.goto('/admin/launcher');
    await page.getByRole('button', { name: 'View all MRR follow-ups' }).click();
    await expect(page.getByLabel('Follow-up only')).toBeChecked();
    await expect(page.getByRole('button', { name: '#7932', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear follow-up for MRR #7931' }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: '#7931', exact: true })).toHaveCount(0);
    await page.goto('/admin/launcher');
    await expect(page.getByText('MRR #7931 flagged for follow-up')).toHaveCount(0);
    await page.goto(`/admin/clients/${client._id}`);
    await expect(page.getByRole('heading', { name: 'Dana Babicova' })).toBeVisible();
    const actions = page.locator('.client-header-actions');
    await expect(actions.getByRole('button')).toHaveCount(4);
    if (width < 640) {
      const boxes = await actions.getByRole('button').evaluateAll(buttons => buttons.map(button => { const b = button.getBoundingClientRect(); return { top: b.top, width: b.width, right: b.right }; }));
      expect(Math.max(...boxes.map(b => b.top)) - Math.min(...boxes.map(b => b.top))).toBeLessThan(2);
      expect(boxes.every(b => b.width <= 36 && b.right <= width)).toBe(true);
      expect(await actions.locator('span').evaluateAll(spans => spans.every(span => getComputedStyle(span).display === 'none'))).toBe(true);
    }
    await page.screenshot({ path: path.join(output, `client-${width}.png`) });
    await actions.getByRole('button', { name: 'Screening', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${client._id}/screening$`));
    expect(errors).toEqual([]);
  });
}
