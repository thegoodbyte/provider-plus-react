import { Page } from '@playwright/test';

export async function mockNavigationApi(page: Page) {
  const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000').origin;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
    const path = url.pathname.replace(/^\/api/, '');
    if (path === '/assistant/tasks-for-today') return route.fulfill({ json: { tasks: [], retreats: [] } });
    if (path === '/launcher-config') return route.fulfill({ json: { assignments: [] } });
    if (path === '/communications/email-safety') return route.fulfill({ json: { enabled: true, recipient: 'test@example.test' } });
    if (path === '/communications/settings') return route.fulfill({ json: {} });
    if (path === '/client-contracts/gate-settings') return route.fulfill({ json: {
      enabled: true, preContractModules: [], portalAccessByStatus: {},
      portalStatusCatalog: [], portalModuleCatalog: [], portalAccessModes: [],
    } });
    if (path.startsWith('/medical-review-public/')) return route.fulfill({ json: { request: { display_id: 123, status: 'pending', clientId: 'client' }, artifacts: [] } });
    return route.fulfill({ json: [] });
  });
}
