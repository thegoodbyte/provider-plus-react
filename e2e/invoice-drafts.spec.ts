import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const file = process.env.INVOICE_DRAFTS_FIXTURE,
  f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Use scripts/run-invoice-drafts-e2e.cjs: required local API/Mongo runner fails without dependencies.",
);
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`eight invoice items survive currency misclick, navigation, offline save and ambiguous issue at ${width}px`, async ({
    page,
    request,
  }) => {
    test.setTimeout(60000);
    await request.post(f.url + "/fixture/invoice-reset");
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "draft-admin",
          role: "admin",
          email: "admin@example.invalid",
        }),
      );
    }, f.tokens.admin);
    let offline = false,
      loseIssueResponse = false;
    const financialWrites: string[] = [];
    await page.route("**/*", async (route) => {
      const q = route.request(),
        u = new URL(q.url());
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      if (
        u.pathname.startsWith("/service-invoice-drafts") ||
        u.pathname.startsWith("/service-payment-requests") ||
        u.pathname.startsWith("/payment-requests") ||
        u.pathname.startsWith("/clients")
      ) {
        if (
          u.pathname.startsWith("/service-invoice-drafts") &&
          q.method() === "PUT" &&
          offline
        )
          return route.abort();
        if (q.method() === "POST" && u.pathname.endsWith("/issue")) {
          financialWrites.push(u.pathname);
          const response = await route.fetch({
            url: f.url + u.pathname + u.search,
          });
          if (loseIssueResponse) {
            loseIssueResponse = false;
            return route.abort();
          }
          return route.fulfill({ response });
        }
        if (!["GET", "PUT"].includes(q.method()))
          throw Error(
            "Unexpected non-draft write " + q.method() + " " + u.pathname,
          );
        return route.fulfill({
          response: await route.fetch({ url: f.url + u.pathname + u.search }),
        });
      }
      if (q.method() !== "GET")
        throw Error("Unexpected write " + q.method() + " " + u.pathname);
      return route.fulfill({
        json:
          u.pathname === "/users/navigation-permissions" ||
          u.pathname.includes("config-summary")
            ? {}
            : u.pathname === "/environment/status"
              ? { production: true }
              : [],
      });
    });
    const snapshot = async () =>
      (await request.get(f.url + "/fixture/invoice-snapshot")).json();
    await page.goto(
      "/admin/payment-requests/services/new?clientId=" + f.ids.client,
    );
    await expect(
      page.getByRole("button", { name: "Save draft now", exact: true }),
    ).toBeEnabled();
    await page
      .getByLabel("Request title")
      .fill("Eight integration items " + width);
    for (let i = 0; i < 8; i++) {
      await page
        .getByRole("button", { name: "Add custom service", exact: true })
        .click();
      await page
        .getByLabel("Description", { exact: true })
        .nth(i)
        .fill("Integration item " + (i + 1));
      await page
        .getByLabel("Unit price (EUR)", { exact: true })
        .nth(i)
        .fill(String(10 + i));
    }
    await expect
      .poll(async () => (await snapshot()).drafts[0]?.payload.items.length)
      .toBe(8);
    await expect(
      page.getByRole("region", { name: "Invoice draft" }),
    ).toContainText("Draft saved");
    expect((await snapshot()).requests).toHaveLength(0);
    expect((await snapshot()).payments).toHaveLength(0);
    await page
      .getByRole("combobox", { name: "Currency", exact: true })
      .selectOption("PLN");
    const currencyDialog = page.getByRole("dialog", {
      name: "Change currency and clear items?",
    });
    await expect(currencyDialog).toBeVisible();
    await currencyDialog.getByRole("button", { name: "Keep items" }).click();
    await expect(currencyDialog).toBeHidden();
    await expect(page.getByLabel("Description", { exact: true })).toHaveCount(
      8,
    );
    await expect(
      page.getByRole("combobox", { name: "Currency", exact: true }),
    ).toHaveValue("EUR");
    await page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await expect(page.getByText("Ready to issue")).toBeVisible();
    await page
      .getByRole("link", { name: "← Payment requests", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/payment-requests$/);
    await expect(
      page.getByRole("button", { name: "Add Payment Request", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Description", { exact: true })).toHaveCount(
      8,
    );
    await expect(
      page.getByRole("button", { name: "Review request", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Issue payment request", exact: true }),
    ).toHaveCount(0);
    offline = true;
    await page
      .getByLabel("Description", { exact: true })
      .nth(7)
      .fill("Integration item 8 - offline edits");
    await expect(
      page.getByRole("region", { name: "Invoice draft" }).getByRole("alert"),
    ).toContainText("Draft save failed");
    offline = false;
    await page.reload();
    await expect(page.getByLabel("Description", { exact: true })).toHaveCount(
      8,
    );
    await expect(
      page.getByLabel("Description", { exact: true }).nth(7),
    ).toHaveValue("Integration item 8 - offline edits");
    await expect
      .poll(
        async () => (await snapshot()).drafts[0]?.payload.items[7].description,
      )
      .toBe("Integration item 8 - offline edits");
    expect((await snapshot()).requests).toHaveLength(0);
    expect(financialWrites).toHaveLength(0);
    if (process.env.INVOICE_DRAFTS_ARTIFACT_DIR)
      await page.getByRole("region", { name: "Invoice draft" }).screenshot({
        path: path.join(
          process.env.INVOICE_DRAFTS_ARTIFACT_DIR,
          `draft-status-${width}.png`,
        ),
      });
    await page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    loseIssueResponse = true;
    await page
      .getByRole("button", { name: "Issue payment request", exact: true })
      .click();
    await expect.poll(async () => (await snapshot()).requests.length).toBe(1);
    await expect(
      page.getByRole("button", { name: "Retry issuance", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await expect(page).toHaveURL(
      /\/admin\/payment-requests\/services\/[a-f0-9]{24}$/,
    );
    await expect(
      page.getByRole("link", { name: "Record payment", exact: true }),
    ).toBeVisible();
    const done = await snapshot();
    expect(done.requests).toHaveLength(1);
    expect(done.requests[0].lineItems).toHaveLength(8);
    expect(done.requests[0].requestedAmount).toBe(108);
    expect(done.payments).toHaveLength(0);
    expect(done.bookings).toHaveLength(0);
    expect(done.effects.emails).toEqual([]);
    expect(done.drafts[0].status).toBe("issued");
    expect(financialWrites).toHaveLength(1);
  });
