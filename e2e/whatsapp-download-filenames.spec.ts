import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath = process.env.PPVC924_FIXTURE;
const f = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')) : {};
test.skip(!fixturePath, 'Requires the portable API WhatsApp filenames fixture');
for (const width of [1440, 390]) for (const clipboardFails of [false, true]) test(`WhatsApp filenames ${clipboardFails ? 'manual fallback' : 'copy'} at ${width}px`, async ({ page, context, request }) => {
  await page.setViewportSize({ width, height: 980 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(({ token, fails }) => {
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify({ id: 'staff', role: 'admin', email: 'admin@example.invalid' }));
    if (fails) Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw Error('Synthetic clipboard denial'); } } });
  }, { token: f.tokens.admin, fails: clipboardFails });
  await page.route('**/*', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path.startsWith('/fixture/document/')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nSynthetic document\n%%EOF' });
    if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
    if (path.endsWith('/access-links')) return route.fulfill({ json: [] });
    if (path.startsWith('/medical-review-requests')) return route.fulfill({ response: await route.fetch({ url: f.url + path + new URL(req.url()).search }) });
    if (path === '/environment/status') return route.fulfill({ json: { environment: 'local', production: false, enabledJobs: [] } });
    return route.fulfill({ json: [] });
  });
  const response = await request.get(f.url + '/medical-review-requests/' + f.requestId + '/context', { headers: { Authorization: 'Bearer ' + f.tokens.admin } });
  expect(response.ok()).toBeTruthy(); const names = (await response.json()).whatsappDownloadNames;
  await page.goto('/admin/medical-review-requests/' + f.requestId);
  const panel = page.getByRole('region', { name: 'WhatsApp download filenames' });
  await expect(panel).toBeVisible();
  for (const name of [names.archiveName, ...names.fileNames]) await expect(panel.getByText(name, { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Copy ' + names.fileNames[0], exact: true }).click();
  if (clipboardFails) await expect(panel.getByRole('status')).toContainText('copy it manually');
  else {
    await expect(panel.getByRole('status')).toContainText('Filename copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(names.fileNames[0]);
    await panel.getByRole('button', { name: 'Copy all filenames', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe([names.archiveName, ...names.fileNames].join('\n'));
  }
  const bounds = await panel.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  await panel.screenshot({ path: `../ppvc-924-validation/filenames-${width}-${clipboardFails ? 'fallback' : 'copy'}.png` });
  await page.reload();
  await expect(page.getByRole('region', { name: 'WhatsApp download filenames' }).getByText(names.fileNames[0], { exact: true })).toBeVisible();
});
