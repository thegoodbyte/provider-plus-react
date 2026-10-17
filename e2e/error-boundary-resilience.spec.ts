import { test, expect, Page } from '@playwright/test';

// PPVC-829: a malformed /environment/status response used to crash
// EnvironmentBanner with an unhandled exception -- and since it sits in the
// persistent app shell outside any route boundary, that blanked the entire
// app (nav and all, confirmed by temporarily reverting the EnvironmentBanner
// fix while writing this test: the new top-level ErrorBoundary in App.tsx
// still caught it and showed a recoverable "Something went wrong" alert
// instead of a blank page, but the whole shell -- including nav -- is what
// gets replaced by that top-level fallback, since EnvironmentBanner and nav
// share the same ancestor boundary). With EnvironmentBanner's own defensive
// fix in place, this specific case no longer reaches the boundary at all --
// nav stays visible.

async function mockApi(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-token');
    localStorage.setItem('user', JSON.stringify({ id: 'admin', role: 'admin', email: 'admin@example.test' }));
  });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    // Deliberately malformed: an empty array instead of a status object --
    // this is exactly what a generic "unmatched route" mock fallback returns.
    if (path === '/environment/status') return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
}

test('PPVC-829: a malformed environment status response no longer crashes the app shell', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await mockApi(page);
  await page.goto('/admin/clients');
  await expect(page.getByRole('navigation')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
