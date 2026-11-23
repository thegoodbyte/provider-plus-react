import { test, expect } from "@playwright/test";
import fs from "node:fs";
const file = process.env.NON_CASH_FIXTURE;
const f: any = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(!file, "Requires disposable real API/Mongo non-cash fixture");
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`painting settlement persists and credits accepted goods at ${width}px`, async ({
    page,
    request,
  }) => {
    await request.post(f.url + "/fixture/noncash-reset");
    const state = async () =>
      (await request.get(f.url + "/fixture/noncash-state")).json();
    const before = await state();
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "synthetic-admin",
          role: "admin",
          email: "test@example.invalid",
        }),
      );
    }, f.tokens.admin);
    await page.route("**/*", async (route) => {
      const r = route.request();
      if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
      const u = new URL(r.url());
      if (
        /^\/(payments|payment-requests|clients|bookings|retreats?|fixture)(\/|$)/.test(
          u.pathname,
        )
      ) {
        const response = await route.fetch({
          url: f.url + u.pathname + u.search,
        });
        return route.fulfill({ response });
      }
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/payments/new?paymentRequestId=" + f.ids.request);
    await page
      .getByLabel("Payment method", { exact: true })
      .selectOption("other");
    await page
      .getByRole("checkbox", {
        name: "Goods or services instead of money (non-cash / barter)",
      })
      .check();
    await page
      .getByLabel("Goods or services received", { exact: true })
      .fill("Painting accepted, delivery 1 of 10");
    await page.getByLabel("Non-cash quantity", { exact: true }).fill("1");
    await page
      .getByLabel("Non-cash value per item", { exact: true })
      .fill("800");
    await page
      .getByLabel("Non-cash valuation explanation", { exact: true })
      .fill("Agreed value for original painting");
    await page.getByLabel("Status", { exact: true }).selectOption("completed");
    await expect(page.getByLabel("Amount", { exact: true })).toHaveValue(
      "800.00",
    );
    await expect(page.getByLabel("Amount", { exact: true })).toHaveAttribute(
      "readonly",
      "",
    );
    await page.screenshot({
      path: test.info().outputPath("noncash-form-" + width + ".png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Add Payment", exact: true })
      .click();
    await expect.poll(async () => (await state()).payments.length).toBe(1);
    let s = await state(),
      payment = s.payments[0],
      b = s.bookings.find((x: any) => x._id === f.ids.booking);
    expect(b.amountPaid).toBe(800);
    expect(b.financialSummary.balance).toBe(7200);
    expect(payment.nonCashSettlement.unitValue).toBe(800);
    await page.goto("/admin/payments/" + payment._id + "/edit");
    await expect(
      page.getByLabel("Goods or services received", { exact: true }),
    ).toHaveValue("Painting accepted, delivery 1 of 10");
    await page.reload();
    await expect(
      page.getByLabel("Non-cash value per item", { exact: true }),
    ).toHaveValue("800");
    await page.getByLabel("Non-cash quantity", { exact: true }).fill("10");
    await expect(page.getByLabel("Amount", { exact: true })).toHaveValue(
      "8000.00",
    );
    await page
      .getByRole("button", { name: "Update Payment", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state()).bookings.find((x: any) => x._id === f.ids.booking)
            .amountPaid,
      )
      .toBe(8000);
    s = await state();
    expect(s.payments).toHaveLength(1);
    expect(s.receipts).toHaveLength(1);
    expect(s.requests.find((x: any) => x._id === f.ids.request).status).toBe(
      "paid",
    );
    expect(s.bookings.find((x: any) => x._id === f.ids.otherBooking)).toEqual(
      before.bookings.find((x: any) => x._id === f.ids.otherBooking),
    );
    expect(s.emails).toEqual([]);
    expect(s.pdf).toEqual([]);
    await page.goto("/admin/payments/" + payment._id);
    await expect(
      page.getByRole("heading", {
        name: "Non-cash settlement record",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("noncash-saved-" + width + ".png"),
      fullPage: true,
    });
  });
