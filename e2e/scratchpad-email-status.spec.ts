import { test, expect } from "@playwright/test";
import fs from "node:fs";
// Both viewport journeys reset and advance the same disposable email fixture.
test.describe.configure({ mode: "serial" });
const fixturePath = process.env.SCRATCHPAD_EMAIL_FIXTURE;
const f = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, "utf8")) : {};
test.describe.configure({ mode: "serial" });
test.skip(
  !fixturePath,
  "Requires the disposable real Mongo/Nest scratchpad email fixture",
);
for (const width of [1440, 390])
  test(`scratchpad email envelopes and refreshed delivery at ${width}px`, async ({
    page,
    request,
  }) => {
    await request.post(f.url + "/fixture/reset");
    const before = await (
      await request.get(f.url + "/fixture/snapshot")
    ).json();
    await page.setViewportSize({ width, height: 1080 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "staff",
          role: "admin",
          email: "admin@example.invalid",
        }),
      );
    }, f.tokens.admin);
    let writes = 0;
    await page.route("**/*", async (route) => {
      const r = route.request(),
        u = new URL(r.url());
      if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
      if (!["GET", "HEAD"].includes(r.method())) writes++;
      if (u.pathname.startsWith("/payment-scratchpad"))
        return route.fulfill({
          response: await route.fetch({ url: f.url + u.pathname + u.search }),
        });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    const path = "/admin/payments/scratchpad?status=all";
    await page.goto(path);
    const row = (index: number) =>
      page
        .getByRole("link", { name: "#" + f.rows[index].displayId, exact: true })
        .locator("xpath=ancestor::tr");
    await expect(
      row(0).getByRole("img", { name: /Receipt email sent/ }),
    ).toBeVisible();
    await expect(
      row(1).getByRole("img", {
        name: "No receipt email recorded for this payment",
      }),
    ).toBeVisible();
    await expect(
      row(2).getByRole("img", { name: /Receipt email queued/ }),
    ).toBeVisible();
    await expect(
      row(3).getByRole("img", { name: /Receipt email failed/ }),
    ).toBeVisible();
    await expect(
      row(4).getByRole("img", {
        name: "No receipt email recorded for this payment",
      }),
    ).toBeVisible();
    await expect(row(0).locator('.lucide-mail-check')).toHaveCount(1);
    for (const index of [1, 2, 3, 4, 5, 6]) {
      await expect(row(index).locator('.lucide-mail, .lucide-mail-check, .lucide-mail-warning')).toHaveCount(0);
      await expect(row(index).locator('.lucide-circle')).toHaveCount(1);
    }
    await page.screenshot({ path: `${process.env.SCRATCHPAD_EMAIL_ARTIFACT_DIR || "test-results/scratchpad-email"}/status-table-${width}.png` });
    const link = row(0).getByRole("link", { name: "#1938", exact: true });
    await expect(link).toHaveAttribute(
      "href",
      "/admin/payments/" + f.rows[0].paymentId,
    );
    const cell = link.locator("..").locator("..");
    await cell.screenshot({
      path: `${process.env.SCRATCHPAD_EMAIL_ARTIFACT_DIR || "test-results/scratchpad-email"}/email-cell-${width}.png`,
    });
    const image = await row(0)
      .getByRole("img", { name: /Receipt email sent/ })
      .boundingBox();
    expect(image!.width).toBeLessThanOrEqual(20);
    await page.getByRole("link", { name: "SP-1938", exact: true }).click();
    const detail = page.getByRole("region", { name: "Receipt details" });
    await expect(
      detail.getByRole("img", { name: /Receipt email sent/ }),
    ).toBeVisible();
    await page.reload();
    await expect(
      detail.getByRole("img", { name: /Receipt email sent/ }),
    ).toBeVisible();
    await page.goto(path);
    await expect(
      row(2).getByRole("img", { name: /Receipt email queued/ }),
    ).toBeVisible();
    await request.post(f.url + "/fixture/complete-email");
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      row(2).getByRole("img", { name: /Receipt email sent/ }),
    ).toBeVisible();
    await expect(row(2).locator('.lucide-mail-check')).toHaveCount(1);
    await expect(row(2).locator('.lucide-circle')).toHaveCount(0);
    expect(writes).toBe(0);
    expect(
      await (await request.get(f.url + "/fixture/snapshot")).json(),
    ).toEqual(before);
  });
