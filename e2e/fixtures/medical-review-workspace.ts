import { test as base, expect } from "@playwright/test";
import path from "node:path";
export const test = base.extend<{ reviewWorkspace: any }>({
  reviewWorkspace: async ({ page }, use) => {
    const root = path.resolve(process.env.TEST_API_CHECKOUT || "../api"),
      f = await require(
        path.join(root, "test/medical-review-workspace.fixture.cjs"),
      ).createFixture();
    try {
      await f.app.listen(0, "127.0.0.1");
      const url = await f.app.getUrl();
      await page.addInitScript((token) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ role: "admin", email: "admin@example.invalid" }),
        );
      }, f.tokens.admin);
      await page.route("**/*", async (route) => {
        const q = route.request(),
          u = new URL(q.url());
        if (!["xhr", "fetch"].includes(q.resourceType()))
          return route.continue();
        if (
          u.pathname === "/medical-review-requests/groups" ||
          u.pathname === "/medical-review-groups"
        )
          return route.fulfill({ json: [] });
        if (u.pathname.startsWith("/medical-review-requests"))
          return route.fulfill({
            response: await route.fetch({ url: url + u.pathname + u.search }),
          });
        if (u.pathname === "/users")
          return route.fulfill({ json: await f.models.User.find().lean() });
        if (u.pathname === "/retreats")
          return route.fulfill({ json: await f.models.Retreat.find().lean() });
        if (u.pathname === "/environment/status")
          return route.fulfill({
            json: { environment: "local", production: false, enabledJobs: [] },
          });
        return route.fulfill({ json: [] });
      });
      await use({ ...f, url });
    } finally {
      await page.unrouteAll({ behavior: "wait" });
      await page.close();
      f.app.getHttpServer().closeIdleConnections?.();
      await f.close();
    }
  },
});
export { expect };
