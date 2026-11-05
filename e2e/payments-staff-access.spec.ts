import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
const file = process.env.STAFF_FINANCE_FIXTURE,
  f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Requires real staff-finance fixture with auth, domain services and Mongo schemas/indexes",
);
test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });
async function routeBackend(page: Page) {
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (!["fetch", "xhr"].includes(req.resourceType())) return route.continue();
    const u = new URL(req.url()),
      p = u.pathname.replace(/^\/api(?=\/)/, "");
    if (["api.exchangerate-api.com", "api.fxratesapi.com"].includes(u.hostname))
      return route.fulfill({
        json: { base: "USD", rates: { USD: 1, PLN: 4, EUR: 0.9, CZK: 23 } },
      });
    if (p === "/health") return route.fulfill({ json: { status: "ok" } });
    if (p === "/environment/status")
      return route.fulfill({
        json: { environment: "local", production: false, enabledJobs: [] },
      });
    if (p === "/work-modes")
      return route.fulfill({
        json: { workspace: { activeMode: "" }, sessions: [] },
      });
    if (p === "/config-summary") return route.fulfill({ json: {} });
    const r = await route.fetch({ url: f.url + p + u.search });
    return route.fulfill({ response: r });
  });
}
async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: /Sign in/i }).click();
}
for (const width of [1440, 390])
  test(`Payments worker financial journey, forbidden data and live revocation at ${width}px`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    const reset = await (await request.post(f.url + "/fixture/reset")).json();
    Object.assign(f, reset);
    await page.setViewportSize({ width, height: 1000 });
    await routeBackend(page);
    const failures: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    const responseBodies: string[] = [];
    page.on("response", async (response) => {
      if (["fetch", "xhr"].includes(response.request().resourceType()))
        try {
          responseBodies.push(await response.text());
        } catch {}
    });
    await login(page, "worker@example.invalid");
    await expect(
      page.getByText("Payments workspace", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Clients", exact: true }).click();
    await page
      .locator("article")
      .filter({ hasText: "Anna Synthetic" })
      .getByRole("link", { name: "Open financial details →" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Client financial overview" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Payment transactions" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Booking #1400", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Booking #1400", exact: true })
      .click();
    await expect(page.getByText("Agreed price", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Paid after refunds", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: /Retreat Synthetic guided retreat/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Retreat financial overview" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Booking #1400", exact: true }),
    ).toBeVisible();
    await page.goto("/admin/payments/" + f.ids.payments[0] + "/edit");
    await expect(
      page.getByRole("heading", { name: "Edit Payment", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Amount", { exact: true }).fill("425");
    const paymentSaved = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        new URL(r.url()).pathname.endsWith("/payments/" + f.ids.payments[0]),
    );
    await page
      .getByRole("button", { name: "Update Payment", exact: true })
      .click();
    expect((await paymentSaved).status()).toBe(200);
    const savedPayment = await (
      await request.get(f.url + "/payments/" + f.ids.payments[0], {
        headers: { Authorization: "Bearer " + f.tokens.worker },
      })
    ).json();
    expect(Number(savedPayment.amount)).toBe(425);
    await page
      .getByRole("link", { name: "Match receipts", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Payment scratchpad" }),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await page
      .getByRole("button", { name: "New receipt", exact: true })
      .click();
    await page.getByLabel("Amount received", { exact: true }).fill("200");
    await page
      .getByLabel("Payer name (optional)", { exact: true })
      .fill("Finance UI receipt");
    await page
      .getByRole("button", { name: "Save receipt", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Receipt details" })
        .getByText(/Finance UI receipt/)
        .first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Clients", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Clients", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${process.env.STAFF_FINANCE_ARTIFACT_DIR || "test-results"}/clients-${width}.png`,
      fullPage: true,
    });
    await page.goto("/admin/medical-artifacts");
    expect(failures).toEqual([]);
    await expect(page.getByRole("alert")).toContainText(
      "outside the Payments workspace",
    );
    expect(responseBodies.join(" ")).not.toMatch(
      /MEDICAL_SENTINEL|MEDICATION_SENTINEL|PRIVATE_NOTE_SENTINEL|SECRET_PORTAL_PIN|BOOKING_HEALTH_SENTINEL|REQUEST_PRIVATE_SENTINEL|PAYMENT_PRIVATE_SENTINEL/,
    );
    const forbidden = await request.get(f.url + "/medical-artifacts", {
      headers: { Authorization: "Bearer " + f.tokens.worker },
    });
    expect(forbidden.status()).toBe(403);
    await request.put(f.url + "/staff-access/users/" + f.ids.worker, {
      headers: { Authorization: "Bearer " + f.tokens.admin },
      data: {
        profiles: [],
        capabilities: [],
        revision: 1,
        requestKey: crypto.randomUUID(),
      },
    });
    await page.goto("/admin/clients");
    await expect(page.getByRole("alert")).toContainText(
      "No work profile is assigned",
    );
    await expect(
      page.getByRole("heading", { name: "Clients", exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await request.get(f.url + "/payments", {
          headers: { Authorization: "Bearer " + f.tokens.worker },
        })
      ).status(),
    ).toBe(403);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("Administrator assigns and revokes a real staff grant through Work access", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  Object.assign(f, await (await request.post(f.url + "/fixture/reset")).json());
  await routeBackend(page);
  await login(page, "admin@example.invalid");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toHaveCount(
    0,
  );
  await page.goto("/admin/users");
  const row = page
    .getByRole("row")
    .filter({ hasText: "reader@example.invalid" });
  await row.getByRole("button", { name: "Work access", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Assign work access" });
  await dialog
    .getByLabel("Record and edit payments/receipts", { exact: true })
    .check();
  await dialog.getByRole("button", { name: "Save work access" }).click();
  await expect(dialog).toHaveCount(0);
  let grant = await (
    await request.get(f.url + "/staff-access/me", {
      headers: { Authorization: "Bearer " + f.tokens.reader },
    })
  ).json();
  expect(grant.capabilities).toContain("finance.capture");
  await row.getByRole("button", { name: "Work access", exact: true }).click();
  await expect(
    dialog.getByLabel("Record and edit payments/receipts", { exact: true }),
  ).toBeChecked();
  await dialog.getByLabel("View financial records", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Save work access" }).click();
  await expect(dialog).toHaveCount(0);
  grant = await (
    await request.get(f.url + "/staff-access/me", {
      headers: { Authorization: "Bearer " + f.tokens.reader },
    })
  ).json();
  expect(grant.profiles).toEqual([]);
  expect(
    (
      await request.get(f.url + "/clients", {
        headers: { Authorization: "Bearer " + f.tokens.reader },
      })
    ).status(),
  ).toBe(403);
});
