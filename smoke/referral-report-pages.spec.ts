import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const path = process.env.PPVC893_FIXTURE,
  f = path ? JSON.parse(readFileSync(path, "utf8")) : {};
test.skip(!path, "Requires isolated PPVC-893 seeded Mongo/Nest fixture.");
test.setTimeout(90000);
for (const failure of [false, true])
  test(
    failure
      ? "a failed later page never becomes partial financial totals"
      : "all pages contribute to referral balances, including older unpaid bookings",
    async ({ page }) => {
      await page.setViewportSize({ width: failure ? 390 : 1440, height: 1000 });
      let pages = 0;
      await page.addInitScript((token) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: "synthetic",
            role: "admin",
            email: "staff@example.invalid",
          }),
        );
      }, f.token);
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (
          url.origin === new URL(process.env.SMOKE_BASE_URL!).origin &&
          !url.pathname.startsWith("/api/")
        )
          return route.continue();
        const p = url.pathname.replace(/^\/api(?=\/)/, "");
        if (p === "/referrals/report/pages" || p === "/referrals") {
          if (p.endsWith("/pages")) {
            pages++;
            if (failure && pages === 2)
              return route.fulfill({
                status: 503,
                json: { message: "Synthetic later-page failure" },
              });
          }
          const response = await route.fetch({ url: f.url + p + url.search });
          return route.fulfill({ response });
        }
        return route.fulfill({
          json: p === "/environment/status" ? { production: false } : [],
        });
      });
      await page.goto("/admin/referrals");
      if (failure) {
        await expect(page.getByRole("alert")).toContainText(
          "Commission summary is unavailable",
        );
        await expect(
          page.getByText("Unavailable", { exact: true }).first(),
        ).toBeVisible();
        await expect(
          page.getByText("Outstanding", { exact: true }).locator(".."),
        ).toContainText("Unavailable");
      } else {
        await expect(
          page.getByText("Outstanding", { exact: true }).locator(".."),
        ).toContainText(String(f.expectedOutstanding), { timeout: 60000 });
        expect(pages).toBe(50);
        await expect(
          page.getByRole("link", { name: "Main", exact: true }),
        ).toBeVisible();
      }
      await page.screenshot({
        path: `../ppvc-893-validation/report-${failure ? "failure-mobile" : "complete-desktop"}.png`,
        fullPage: true,
      });
    },
  );
