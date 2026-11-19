import { test as base, expect } from "@playwright/test";
import path from "node:path";

// Production controllers, services, schemas and indexes; disposable loopback MongoDB.
// Outbound delivery/S3 are captured by the API fixture. Never loads AppModule or production .env.
export const test = base.extend<{ clientWorkspace: any }>({
  clientWorkspace: async ({ page }, use) => {
    const apiRoot = path.resolve(process.env.TEST_API_CHECKOUT || "../api");
    const { createFixture } = require(
      path.join(apiRoot, "test/screening-workspace.fixture.cjs"),
    );
    const f = await createFixture();
    try {
      await f.app.listen(0, "127.0.0.1");
      const url = await f.app.getUrl();
      const token = f.tokens.admin;
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
      }, token);
      await page.route("**/*", async (route) => {
        if (!["xhr", "fetch"].includes(route.request().resourceType()))
          return route.continue();
        const p = new URL(route.request().url());
        if (p.pathname === "/clients" || p.pathname.startsWith("/clients/"))
          return route.fulfill({
            response: await route.fetch({ url: url + p.pathname + p.search }),
          });
        if (p.pathname === "/environment/status")
          return route.fulfill({
            json: { environment: "local", production: false, enabledJobs: [] },
          });
        if (p.pathname === "/users/navigation-permissions")
          return route.fulfill({ json: {} });
        return route.fulfill({ json: [] });
      });
      await use({ ...f, url, token });
    } finally {
      await page.unrouteAll({ behavior: "wait" });
      await page.close();
      f.app.getHttpServer().closeIdleConnections?.();
      await f.close();
    }
  },
});
export { expect };
