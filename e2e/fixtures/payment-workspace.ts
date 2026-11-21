import { test as base, expect } from "@playwright/test";
import path from "node:path";
export const test = base.extend<{ paymentWorkspace: any }>({
  paymentWorkspace: async ({ page }, use) => {
    const root = path.resolve(process.env.TEST_API_CHECKOUT || "../api"),
      f = await require(
        path.join(root, "test/guided-scratchpad.fixture.cjs"),
      ).createFixture();
    try {
      await f.app.listen(0, "127.0.0.1");
      const url = await f.app.getUrl();
      await f.models.RetreatClient.create({
        _id: "000000000000000000001001",
        bookingNumber: 9501,
        clientId: f.ids.clients[0],
        retreatId: f.ids.retreat,
        status: "confirmed",
        registrationDate: new Date("2026-11-01T12:00:00Z"),
        roomType: "shared",
        accommodationKey: "shared",
        totalAmount: 2500,
        currency: "PLN",
        paymentPlanEnabled: false,
      });
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
          /^\/(payments|payment-requests|bookings|clients)(\/|$)/.test(
            u.pathname,
          )
        )
          return route.fulfill({
            response: await route.fetch({ url: url + u.pathname + u.search }),
          });
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
      // Rows can render while client/booking reads are still proxied. Finish that
      // traffic before removing routes and closing the real API fixture.
      await page.waitForLoadState("networkidle");
      await page.unrouteAll({ behavior: "wait" });
      await page.close();
      f.app.getHttpServer().closeIdleConnections?.();
      await f.close();
    }
  },
});
export { expect };
