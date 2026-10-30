import { test, expect } from "@playwright/test";
const client = {
  _id: "client966",
  display_id: 1305,
  firstName: "Ewa",
  lastName: "Synthetic",
  email: "synthetic@example.invalid",
};
const retreat = {
  _id: "retreat966",
  name: "Synthetic retreat",
  code: "FILTER-966",
  startDate: "2099-01-01",
  endDate: "2099-01-07",
};
const booking = {
  _id: "booking966",
  bookingNumber: 1311,
  clientId: client,
  retreatId: retreat,
  status: "confirmed",
  totalAmount: 2500,
  amountPaid: 1000,
  currency: "PLN",
  paymentPlanEnabled: false,
};
const payments = [
  {
    _id: "linked966",
    display_id: 1211,
    clientId: client,
    retreatId: retreat,
    bookingId: booking,
    paymentRequestId: { _id: "request966", invoiceNumber: 1397 },
    amount: 1000,
    currency: "PLN",
    paymentDate: "2026-10-20T23:59:59.999Z",
    status: "completed",
    paymentMethod: "bank_transfer",
  },
  {
    _id: "unlinked966",
    display_id: 1212,
    clientId: client,
    amount: 200,
    currency: "PLN",
    paymentDate: "2026-10-20T00:00:00.000Z",
    status: "completed",
    paymentMethod: "cash",
  },
  {
    _id: "requestOnly966",
    display_id: 1213,
    clientId: client,
    paymentRequestId: { _id: "request966", invoiceNumber: 1397 },
    amount: 50,
    currency: "EUR",
    paymentDate: "2026-10-21T00:00:00Z",
    status: "pending",
    paymentMethod: "card",
  },
  {
    _id: "repair966",
    display_id: 1214,
    clientId: client,
    bookingId: "missing966",
    amount: 300,
    currency: "PLN",
    paymentDate: "2026-10-22T00:00:00Z",
    status: "completed",
    paymentMethod: "bank_transfer",
    requestLinkPending: true,
  },
];
for (const width of [1440, 390])
  test(`payment filters and confirmation entry are read-only at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes: string[] = [];
    let unavailable = false;
    await page.addInitScript(() => {
      localStorage.setItem("token", "synthetic-token");
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "synthetic@example.invalid" }),
      );
    });
    await page.route("**/*", async (route) => {
      const q = route.request(),
        u = new URL(q.url());
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      if (q.method() !== "GET") {
        writes.push(q.method() + " " + u.pathname);
        return route.abort();
      }
      if (u.pathname === "/payments")
        return route.fulfill(
          unavailable
            ? { status: 503, json: { message: "Synthetic outage" } }
            : { json: payments },
        );
      if (u.pathname === "/clients") return route.fulfill({ json: [client] });
      if (u.pathname === "/retreats") return route.fulfill({ json: [retreat] });
      if (
        u.pathname === "/bookings" ||
        u.pathname.startsWith("/bookings/retreat/")
      )
        return route.fulfill({ json: [booking] });
      if (u.pathname === "/bookings/booking966")
        return route.fulfill({ json: booking });
      if (u.pathname === "/retreats/retreat966")
        return route.fulfill({ json: retreat });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (
        u.pathname.includes("settings") ||
        u.pathname.includes("config-summary")
      )
        return route.fulfill({ json: {} });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/payments?booking=without&request=without");
    await expect(
      page.getByRole("button", { name: "#1212", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "#1211", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Create / link booking" }),
    ).toHaveAttribute("href", "/admin/payments/unlinked966/edit");
    await page
      .getByRole("combobox", { name: "Currency", exact: true })
      .selectOption("PLN");
    await page
      .getByLabel("Payment date from", { exact: true })
      .fill("2026-10-20");
    await page
      .getByLabel("Payment date to", { exact: true })
      .fill("2026-10-20");
    await page.getByLabel("Minimum amount", { exact: true }).fill("200");
    await page.getByLabel("Maximum amount", { exact: true }).fill("200");
    await expect(page.getByText("1 of 4", { exact: true })).toBeVisible();
    const filtered = page.url();
    await page.reload();
    await expect(
      page.getByLabel("Minimum amount", { exact: true }),
    ).toHaveValue("200");
    await expect(
      page.getByRole("button", { name: "#1212", exact: true }),
    ).toBeVisible();
    await page.getByRole("region", { name: "Payment filters" }).screenshot({
      path: `${process.env.PAYMENT_FILTER_ARTIFACT_DIR || "test-results"}/filters-${width}.png`,
    });
    await page.getByLabel("Maximum amount", { exact: true }).fill("100");
    await expect(
      page.getByRole("region", { name: "Payment filters" }).getByRole("alert"),
    ).toContainText("Minimum amount must not exceed maximum amount");
    await page
      .getByRole("button", { name: "Clear all payment filters" })
      .click();
    await page.getByLabel("Unfinished payment updates only").click();
    await expect(
      page.getByLabel("Unfinished payment updates only"),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: "#1214", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "#1211", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Review booking link" }),
    ).toHaveAttribute("href", "/admin/payments/repair966/edit");
    await page
      .getByRole("button", { name: "Clear all payment filters" })
      .click();
    await page
      .getByRole("combobox", { name: "Currency", exact: true })
      .selectOption("PLN");
    await page
      .getByRole("combobox", { name: "Booking link", exact: true })
      .selectOption("with");
    const confirmationReturn =
      new URL(page.url()).pathname + new URL(page.url()).search;
    const confirmation = page.getByRole("link", {
      name: "Booking confirmation",
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    await confirmation.click();
    await expect(
      page.getByRole("region", { name: "Booking confirmation entry" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Preview PDF", exact: true }),
    ).toBeVisible();
    if (width < 600) {
      await page.getByLabel("More booking actions", { exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Review email", exact: true }),
      ).toBeVisible();
      await page.getByLabel("More booking actions", { exact: true }).click();
    } else {
      await expect(
        page.getByRole("button", {
          name: "Review email with PDF attachment",
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { name: "Booking #1311", exact: true }),
    ).toBeVisible();
    expect(writes).toEqual([]);
    await page
      .getByRole("region", { name: "Booking confirmation entry" })
      .screenshot({
        path: `${process.env.PAYMENT_FILTER_ARTIFACT_DIR || "test-results"}/confirmation-${width}.png`,
      });
    await page
      .getByRole("link", { name: "Return to filtered payments" })
      .click();
    await expect
      .poll(() => new URL(page.url()).pathname + new URL(page.url()).search)
      .toBe(confirmationReturn);
    await expect(
      page.getByRole("combobox", { name: "Booking link", exact: true }),
    ).toHaveValue("with");
    unavailable = true;
    await page.reload();
    await expect(
      page.getByRole("alert", { name: "Payment load error" }),
    ).toContainText("temporarily unavailable");
    await expect(
      page.getByText("No payments found", { exact: true }),
    ).toHaveCount(0);
    unavailable = false;
    const globalDismiss = page.getByRole("button", {
      name: "Dismiss loading message",
    });
    if (await globalDismiss.isVisible()) await globalDismiss.click();
    await page.getByRole("button", { name: "Retry payments" }).click();
    await expect(
      page.getByRole("link", { name: "Booking confirmation", exact: true }),
    ).toBeVisible();
    expect(writes).toEqual([]);
  });
