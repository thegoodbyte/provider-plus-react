import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixturePath = process.env.INVOICE_PREVIEW_FIXTURE;
const f = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, "utf8")) : {};
test.skip(
  !fixturePath,
  "Requires real Nest/Mongo admin invoice preview fixture",
);
for (const width of [1440, 390])
  test(`admin invoice skips consent without writes at ${width}px`, async ({
    page,
    request,
  }) => {
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
    const before = await (
      await request.get(f.url + "/fixture/snapshot")
    ).json();
    let writes = 0,
      previewCalls = 0,
      failPreview = true;
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname;
      if (!["xhr", "fetch"].includes(req.resourceType()))
        return route.continue();
      if (!["GET", "HEAD"].includes(req.method())) writes++;
      if (path.endsWith("/invoice-preview")) {
        previewCalls++;
        if (failPreview)
          return route.fulfill({
            status: 503,
            json: { message: "Synthetic preview outage" },
          });
        return route.fulfill({
          response: await route.fetch({ url: f.url + path }),
        });
      }
      if (/^\/payment-requests\/[a-f0-9]{24}$/.test(path))
        return route.fulfill({
          response: await route.fetch({ url: f.url + path }),
        });
      if (path.endsWith("/settlement"))
        return route.fulfill({
          json: {
            requestedAmount: 3800,
            amountReceived: 0,
            amountOutstanding: 3800,
            amountOverpaid: 0,
            currency: "PLN",
            payments: [],
          },
        });
      if (path.startsWith("/invoice-visits/"))
        return route.fulfill({ json: { items: [], total: 0, pageSize: 20 } });
      if (path === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/payment-requests/" + f.requestIds[0]);
    const open = page.getByRole("button", {
      name: "Preview online invoice (admin)",
      exact: true,
    });
    await expect(open).toBeVisible();
    expect(previewCalls).toBe(0);
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Admin invoice preview" });
    await expect(dialog.getByRole("alert")).toContainText(
      "Could not load the invoice preview",
    );
    await expect(dialog.getByRole("article")).toHaveCount(0);
    failPreview = false;
    await dialog.getByRole("button", { name: "Retry invoice preview" }).click();
    await expect(
      dialog.getByRole("heading", { name: "Invoice #1931", exact: true }),
    ).toBeVisible();
    const invoice = dialog.getByRole("article", { name: "Invoice preview" });
    await expect(invoice).toContainText("Synthetic Client");
    await expect(invoice).toContainText("not recorded");
    await expect(invoice).toContainText("3,800.00");
    await expect(
      invoice.getByText("Shared room", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.locator('form,input[type="checkbox"],input[type="text"],canvas'),
    ).toHaveCount(0);
    await dialog.screenshot({
      path: `${process.env.INVOICE_PREVIEW_ARTIFACT_DIR || "../ppvc-931-validation"}/preview-${width}.png`,
    });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await dialog
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
    await page.reload();
    await open.click();
    await expect(
      dialog.getByRole("heading", { name: "Invoice #1931", exact: true }),
    ).toBeVisible();
    expect(writes).toBe(0);
    const after = await (await request.get(f.url + "/fixture/snapshot")).json();
    expect(after).toEqual(before);
    await dialog
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
    await page.goto("/admin/payment-requests/" + f.requestIds[2]);
    await open.click();
    await expect(dialog.getByText(/Cancelled invoice\./)).toBeVisible();
    await expect(dialog.getByRole("article")).toContainText(
      "Synthetic cancellation",
    );
  });
