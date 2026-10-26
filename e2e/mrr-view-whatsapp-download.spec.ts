import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath = process.env.MRR_VIEW_DOWNLOAD_FIXTURE;
const f = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')) : {};
test.skip(!fixturePath, 'Requires disposable real Nest/Mongo download fixture with captured storage delivery');
for (const width of [1440, 390]) for (const mode of ['view', 'edit']) test(`MRR ${mode} downloads its WhatsApp archive at ${width}px`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(token => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify({ id: 'staff', role: 'admin', email: 'admin@example.invalid' })); }, f.tokens.admin);
  const writes: string[] = []; let prepared: any;
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname;
    if (p.startsWith('/fixture/download/')) return route.continue();
    if (!['xhr', 'fetch'].includes(req.resourceType())) return route.continue();
    if (req.method() !== 'GET') { writes.push(req.method() + ' ' + p); return route.fulfill({ status: 405, json: {} }); }
    if (p.endsWith('/access-links')) return route.fulfill({ json: [] });
    if (p.startsWith('/medical-review-requests')) {
      const response = await route.fetch({ url: f.url + p + url.search });
      if (p.endsWith('/whatsapp-download')) { expect(response.ok()).toBeTruthy(); prepared = await response.json(); }
      return route.fulfill({ response });
    }
    if (p === '/environment/status') return route.fulfill({ json: { environment: 'local', production: false, enabledJobs: [] } });
    return route.fulfill({ json: [] });
  });
  const snapshot = async () => { const response = await request.get(f.url + '/fixture/snapshot'); expect(response.ok()).toBeTruthy(); return response.json(); };
  const before = await snapshot();
  const contextResponse = await request.get(f.url + '/medical-review-requests/' + f.requestId + '/context', { headers: { Authorization: 'Bearer ' + f.tokens.admin } });
  expect(contextResponse.ok()).toBeTruthy(); const names = (await contextResponse.json()).whatsappDownloadNames;
  await page.goto('/admin/medical-review-requests/' + f.requestId + (mode === 'edit' ? '/edit' : ''));
  const button = page.getByRole('button', { name: 'Download MRR #1423 for WhatsApp' });
  await expect(button).toBeVisible(); await button.scrollIntoViewIfNeeded();
  const bounds = await button.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  await button.locator('..').screenshot({ path: `${process.env.MRR_VIEW_DOWNLOAD_ARTIFACT_DIR || '../ppvc-934-validation'}/header-${mode}-${width}.png` });
  const downloaded = page.waitForEvent('download'); await button.click(); const download = await downloaded;
  expect(download.suggestedFilename()).toBe(prepared.fileName); expect(prepared.fileName).toBe(names.archiveName);
  const bytes = fs.readFileSync((await download.path())!); expect(bytes.subarray(0, 2).toString()).toBe('PK');
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); expect(end).toBeGreaterThan(0);
  const count = bytes.readUInt16LE(end + 10), entries: string[] = []; let offset = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    expect(bytes.readUInt32LE(offset)).toBe(0x02014b50);
    const length = bytes.readUInt16LE(offset + 28); entries.push(bytes.subarray(offset + 46, offset + 46 + length).toString());
    offset += 46 + length + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  expect(entries.sort()).toEqual([...names.fileNames].sort()); expect(count).toBe(prepared.fileCount);
  expect(await snapshot()).toEqual(before); expect(writes).toEqual([]);
  await page.reload(); await expect(page.getByRole('button', { name: 'Download MRR #1423 for WhatsApp' })).toBeVisible();
});
