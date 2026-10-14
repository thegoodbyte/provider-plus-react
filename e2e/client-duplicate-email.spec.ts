import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`duplicate email toast and correction at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const client = { _id: 'c1', firstName: 'Sample', lastName: 'Guest', email: 'original@example.invalid', phone: '+420777123456', status: 'active' };
    const saves: any[] = [];
    const errors: string[] = [];
    const dialogs: string[] = [];
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource') && message.text() !== 'Warning: [antd: Alert] `message` is deprecated. Please use `title` instead.') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    await page.route('**/*', async route => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue();
      const request = route.request(); const pathname = new URL(request.url()).pathname;
      const json = (value: any, status = 200) => route.fulfill({ status, json: value, headers: { 'Access-Control-Allow-Origin': new URL(test.info().project.use.baseURL as string).origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,PATCH,POST,OPTIONS' } });
      if (request.method() === 'OPTIONS') return json({});
      if (pathname === '/environment/status') return json({ environment: 'development', production: false, enabledJobs: [] });
      if (pathname === '/clients/c1' && request.method() === 'PATCH') {
        const data = request.postDataJSON(); saves.push(data);
        if (data.email === 'taken@example.invalid') return json({ message: `Email ${data.email} is already registered. Please use a different email address.`, error: 'Bad Request', statusCode: 400 }, 400);
        if (data.email === 'failure@example.invalid') return json({ message: 'Temporarily unavailable. Please retry.' }, 503);
        Object.assign(client, data); return json(client);
      }
      if (pathname === '/clients') return json([client]);
      if (pathname === '/') return json({ ok: true });
      return json([]);
    });
    await page.goto('/admin/clients');
    await page.getByTitle('Edit', { exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Client' });
    await editor.getByLabel('Email', { exact: true }).fill('taken@example.invalid');
    await editor.getByLabel('First Name').fill('Edited');
    await editor.getByRole('button', { name: 'Update Client' }).click();
    const toast = editor.getByRole('alert');
    await expect(toast).toHaveText('Duplicate email');
    await expect(toast).toBeVisible();
    const bounds = await toast.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(16);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 16);
    await page.screenshot({ path: `../ppvc-789-validation/duplicate-${width}.png` });
    await expect(editor.getByLabel('Email', { exact: true })).toHaveValue('taken@example.invalid');
    await expect(editor.getByLabel('First Name')).toHaveValue('Edited');
    // Verify the toast is painted above the modal and can be dismissed by the user.
    await toast.getByRole('button', { name: 'Dismiss' }).click();
    await expect(toast).toHaveCount(0);
    await editor.getByLabel('Email', { exact: true }).fill('failure@example.invalid');
    await editor.getByRole('button', { name: 'Update Client' }).click();
    await expect(toast).toHaveText('Temporarily unavailable. Please retry.');
    await expect(editor.getByLabel('First Name')).toHaveValue('Edited');
    await editor.getByLabel('Email', { exact: true }).fill('unique@example.invalid');
    await editor.getByRole('button', { name: 'Update Client' }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText('Client updated successfully.');
    await page.reload();
    await page.getByTitle('Edit', { exact: true }).click();
    await expect(editor.getByLabel('Email', { exact: true })).toHaveValue('unique@example.invalid');
    await editor.getByRole('button', { name: 'Update Client' }).click();
    await expect(editor).toHaveCount(0);
    expect(saves.map(save => save.email)).toEqual(['taken@example.invalid', 'failure@example.invalid', 'unique@example.invalid', 'unique@example.invalid']);
    expect(dialogs).toEqual([]); expect(errors).toEqual([]);
  });
}
