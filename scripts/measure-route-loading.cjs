// node scripts/measure-route-loading.cjs [output.json] -- production build required.
// Synthetic read-only API responses: this never contacts the real backend.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { chromium } = require('@playwright/test');
const root = path.resolve(process.env.MEASURE_BUILD_DIR || 'build');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'asset-manifest.json')));
const entry = manifest.entrypoints.filter(f => f.endsWith('.js')).map(file => {
  const data = fs.readFileSync(path.join(root, file));
  return { file, bytes: data.length, gzipBytes: zlib.gzipSync(data).length };
});
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' });
  res.end(zlib.gzipSync(fs.readFileSync(file)));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [{ origin, localStorage: [
        { name: 'token', value: 'measurement-only' },
        { name: 'user', value: JSON.stringify({ id: 'measurement', role: 'admin', email: 'test@example.test' }) },
      ] }] } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname.endsWith('/assistant/tasks-for-today')) return route.fulfill({ json: { tasks: [], retreats: [] } });
        if (url.pathname.endsWith('/launcher-config')) return route.fulfill({ json: { assignments: [] } });
        return route.fulfill({ json: [] });
      });
      const session = await context.newCDPSession(page);
      await session.send('Network.enable');
      await session.send('Network.setCacheDisabled', { cacheDisabled: true });
      await session.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: 625000, uploadThroughput: 625000 });
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(`${origin}/admin/launcher`);
      await page.getByRole('heading', { name: 'Module Launcher', exact: true }).waitFor();
      runs.push(await page.evaluate(() => ({
        launcherReadyMs: Math.round(performance.now()),
        fcpMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
        domContentLoadedMs: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
        scripts: performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script').map(r => ({ file: new URL(r.name).pathname, transferredBytes: r.transferSize, decodedBytes: r.decodedBodySize })),
      })));
      if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
      await context.close();
    }
    const median = key => runs.map(run => run[key]).sort((a, b) => a - b)[2];
    const result = { measuredAt: new Date().toISOString(), browser: browser.version(), conditions: 'Local gzip production server; new context/cache disabled per run; mocked APIs; CPU 4x; 5 Mbps download; 50ms latency; 5 runs', entry, median: { launcherReadyMs: median('launcherReadyMs'), fcpMs: median('fcpMs'), domContentLoadedMs: median('domContentLoadedMs') }, runs };
    const json = JSON.stringify(result, null, 2);
    if (process.argv[2]) fs.writeFileSync(process.argv[2], json + '\n');
    console.log(json);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
