import { test, expect } from "@playwright/test";
import fs from "node:fs";
const path = process.env.REQUEST_EXISTING_PAYMENT_FIXTURE;
const f = path ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
test.skip(
  !path,
  "Use scripts/run-request-existing-payment-e2e.cjs for no-skip real Mongo/API validation.",
);
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`PR grid links recorded scratchpad money with safe retry at ${width}px`, async ({
    page,
    request,
  }) => {
    const reset = await request.post(f.url + "/fixture/request-link-reset");
    expect(reset.ok()).toBe(true);
    const { ids } = await reset.json();
    const snapshot = async () =>
      (await request.get(f.url + "/fixture/search-snapshot")).json();
    const before = await snapshot();
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "synthetic@example.invalid" }),
      );
    }, f.tokens.admin);
    const writes: string[] = [];
    let unavailable = true;
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (!["xhr", "fetch"].includes(req.resourceType()))
        return route.continue();
      if (req.method() !== "GET")
        writes.push(req.method() + " " + url.pathname);
      if (url.pathname.endsWith("/payment-candidates") && unavailable)
        return route.fulfill({
          status: 503,
          json: { message: "Synthetic search outage" },
        });
      if (
        url.pathname.startsWith("/payment-requests") ||
        url.pathname.startsWith("/payments")
      ) {
        const response = await route.fetch({
          url: f.url + url.pathname + url.search,
        });
        return route.fulfill({ response });
      }
      if (req.method() !== "GET") return route.abort();
      if (url.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (
        url.pathname.includes("settings") ||
        url.pathname.includes("config-summary")
      )
        return route.fulfill({ json: {} });
      return route.fulfill({ json: [] });
    });
    const gridRow = () =>
      page
        .locator("tbody tr")
        .filter({
          has: page.getByRole("button", { name: "1900", exact: true }),
        });
    await page.goto("/admin/payment-requests");
    await gridRow()
      .getByRole("button", { name: "Link existing payment", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Retry matching payments" }),
    ).toBeVisible();
    unavailable = false;
    await dialog
      .getByRole("button", { name: "Retry matching payments" })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Next payments" }),
    ).toBeVisible();
    await dialog
      .getByLabel("Payment date from", { exact: true })
      .fill("2026-10-20");
    await dialog
      .getByLabel("Payment date to", { exact: true })
      .fill("2026-10-20");
    await expect(
      dialog.getByRole("checkbox", { name: "Select payment #9410" }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole("checkbox", { name: "Select payment #9411" }),
    ).toHaveCount(0);
    await expect(dialog.getByText("Recorded from scratchpad", {exact:true})).toBeVisible();
    // Cancelling search must not record or link money.
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await snapshot()).toEqual(before);
    expect(writes).toEqual([]);
    await gridRow()
      .getByRole("button", { name: "Link existing payment", exact: true })
      .click();
    await dialog
      .getByLabel("Payment date from", { exact: true })
      .fill("2026-10-20");
    await dialog
      .getByLabel("Payment date to", { exact: true })
      .fill("2026-10-20");
    await dialog
      .getByRole("checkbox", { name: "Select payment #9410" })
      .check();
    const confirm = dialog.getByRole("button", {
      name: "Confirm existing payment link",
    });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/I checked the client/).check();
    await request.post(f.url + "/fixture/fail-link-refresh");
    await confirm.click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Retry this same link",
    );
    await expect(
      dialog.getByRole("checkbox", { name: "Select payment #9410" }),
    ).toBeChecked();
    await dialog.screenshot({
      path: `${process.env.REQUEST_EXISTING_PAYMENT_ARTIFACT_DIR || "test-results"}/link-${width}.png`,
    });
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    const saved = await snapshot();
    expect(saved.payments).toHaveLength(before.payments.length);
    expect(saved.legacy).toEqual(before.legacy);
    expect(saved.emails).toEqual([]);
    const payment = saved.payments.find((p: any) => p._id === ids.payments[0]);
    expect(payment.paymentRequestId).toBe(ids.request);
    expect(payment.sourceScratchpadId).toBe(ids.receipts[0]);
    expect(payment.amount).toBe(100);
    expect(
      saved.requests.find((r: any) => r._id === ids.request).amountReceived,
    ).toBe(100);
    expect(
      saved.requests.find((r: any) => r._id === ids.request).status,
    ).not.toBe("paid");
    expect(saved.bookings[0].amountPaid).toBe(100);
    expect(saved.bookings[0].totalAmount).toBe(7500);
    await gridRow()
      .getByRole("button", { name: "Link existing payment", exact: true })
      .click();
    await dialog
      .getByLabel("Payment date from", { exact: true })
      .fill("2026-10-20");
    await expect(
      dialog.getByRole("checkbox", { name: "Select payment #9410" }),
    ).toBeDisabled();
    await expect(
      dialog.getByText("Already linked to this request"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(writes).toEqual([
      "POST /payments/" + ids.payments[0] + "/link-request",
      "POST /payments/" + ids.payments[0] + "/link-request",
    ]);
  });
