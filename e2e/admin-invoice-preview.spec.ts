import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixturePath = process.env.INVOICE_PREVIEW_FIXTURE,
  website = process.env.INVOICE_CLIENT_WEBSITE_URL;
test.skip(
  !fixturePath || !website,
  "Requires real API/Mongo fixture and canonical client website",
);
for (const width of [1440, 390])
  test(`actual client renderer parity, language, consent bypass and no writes at ${width}px`, async ({
    page,
    request,
  }) => {
    const f = JSON.parse(fs.readFileSync(fixturePath!, "utf8"));
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
      publicCalls = 0,
      fail = true;
    await page.route("**/*", async (route) => {
      const r = route.request(),
        u = new URL(r.url()),
        p = u.pathname;
      if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
      if (!["GET", "HEAD"].includes(r.method())) writes++;
      if (p.includes("/public/")) {
        publicCalls++;
        return route.fulfill({
          status: 503,
          json: { message: "Preview must never load a public invoice" },
        });
      }
      if (p.endsWith("/invoice-preview")) {
        if (fail)
          return route.fulfill({
            status: 503,
            json: { message: "Synthetic preview outage" },
          });
        return route.fulfill({
          response: await route.fetch({ url: f.url + p }),
        });
      }
      if (/^\/payment-requests\/[a-f0-9]{24}$/.test(p))
        return route.fulfill({
          response: await route.fetch({ url: f.url + p }),
        });
      if (p.endsWith("/settlement"))
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
      if (p.startsWith("/invoice-visits/"))
        return route.fulfill({ json: { items: [], total: 0, pageSize: 20 } });
      if (p === "/environment/status")
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
    await open.click();
    const dialog = page.getByRole("dialog", {
      name: "Client website invoice preview",
    });
    await expect(dialog.getByRole("alert")).toBeVisible();
    fail = false;
    await dialog.getByRole("button", { name: "Retry invoice preview" }).click();
    const frame = page.frameLocator(
      'iframe[title="Actual client invoice page"]',
    );
    await expect(
      frame.getByRole("heading", { name: "Payment Information", exact: true }),
    ).toBeVisible();
    await expect(frame.locator("input,canvas,form")).toHaveCount(0);
    expect(publicCalls).toBe(0);
    // Public client branch uses the same canonical component after device-local
    // synthetic consent; it must retain the normal form on a fresh device.
    const response = await request.get(
      f.url + "/payment-requests/" + f.requestIds[0] + "/invoice-preview",
      { headers: { Authorization: "Bearer " + f.tokens.admin } },
    );
    const { invoice } = await response.json();
    const client = await page.context().newPage();
    await client.route("**/public/invoices/parity", (route) =>
      route.fulfill({ json: invoice }),
    );
    await client.addInitScript(() =>
      localStorage.setItem("deposit-consent:parity", "accepted"),
    );
    const frameBox = await page
      .locator('iframe[title="Actual client invoice page"]')
      .boundingBox();
    await client.setViewportSize({
      width: Math.round(frameBox!.width),
      height: 1000,
    });
    await client.goto(website + "/clients/payment/request/parity?lang=en");
    const normal = client.locator("div.min-h-screen.bg-gradient-to-br").first(),
      actual = frame.locator("[data-admin-invoice-preview] > div");
    await expect(
      normal.getByRole("heading", { name: "Payment Information", exact: true }),
    ).toBeVisible();
    expect(await actual.innerText()).toBe(await normal.innerText());
    const presentation = async (locator: any) =>
      locator.evaluate((el: Element) => {
        const s = getComputedStyle(el);
        return {
          background: s.backgroundImage,
          color: s.color,
          font: s.fontFamily,
        };
      });
    expect(await presentation(actual)).toEqual(await presentation(normal));
    await client.close();
    await frame.locator('a[href*="revolut"]').first().click();
    expect(page.context().pages()).toHaveLength(1);
    expect(publicCalls).toBe(0);
    await dialog.getByLabel("Preview language").selectOption("pl");
    await expect(
      frame.getByRole("heading", {
        name: "Informacja o płatności",
        exact: true,
      }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Mobile view", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Mobile view", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await dialog.screenshot({
      path: `${process.env.INVOICE_PREVIEW_ARTIFACT_DIR || "test-results"}/actual-client-${width}.png`,
      animations: "disabled",
    });
    const frameUrl = await page
      .locator('iframe[title="Actual client invoice page"]')
      .getAttribute("src");
    expect(frameUrl).toBe(website + "/clients/payment/admin-preview");
    expect(frameUrl).not.toContain(f.requestIds[0]);
    await dialog
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
    await page.reload();
    await open.click();
    await expect(
      frame.getByRole("heading", { name: "Payment Information", exact: true }),
    ).toBeVisible();
    expect(writes).toBe(0);
    expect(publicCalls).toBe(0);
    expect(
      await (await request.get(f.url + "/fixture/snapshot")).json(),
    ).toEqual(before);
  });
