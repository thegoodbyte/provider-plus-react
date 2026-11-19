import { test as base, expect } from "@playwright/test";
import path from "node:path";
export const test = base.extend<{ referralWorkspace: any }>({
  referralWorkspace: async ({ page }, use) => {
    const apiRoot = path.resolve(process.env.TEST_API_CHECKOUT || "../api");
    const f = await require(
      path.join(apiRoot, "test/referral-workspace.fixture.cjs"),
    ).createFixture();
    try {
      await f.app.listen(0, "127.0.0.1");
      const url = await f.app.getUrl();
      await page.addInitScript((token) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: "synthetic-admin",
            role: "admin",
            email: "admin@example.invalid",
          }),
        );
      }, f.tokens.admin);
      await page.route("**/*", async (route) => {
        const q = route.request(),
          u = new URL(q.url());
        if (!["xhr", "fetch"].includes(q.resourceType()))
          return route.continue();
        if (u.pathname.startsWith("/referrals"))
          return route.fulfill({
            response: await route.fetch({ url: url + u.pathname + u.search }),
          });
        if (u.pathname === "/environment/status")
          return route.fulfill({
            json: { environment: "local", production: false, enabledJobs: [] },
          });
        return route.fulfill({ json: [] });
      });
      await use({ ...f, url });
    } finally {
      await f.close();
    }
  },
});
export { expect };
