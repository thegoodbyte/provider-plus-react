import { test, expect } from "@playwright/test";
const client = {
  _id: "client961",
  firstName: "Synthetic",
  lastName: "Guest",
  email: "synthetic@example.invalid",
  language: "PL",
};
for (const width of [1440, 390])
  test(`View payment invoice link, preview and email review without writes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes: string[] = [];
    let unavailable = true,
      blocked = false;
    await page.addInitScript(() => {
      localStorage.setItem("token", "synthetic-token");
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "staff@example.invalid" }),
      );
    });
    await page.route("**/*", async (route) => {
      const q = route.request(),
        u = new URL(q.url());
      if (u.href === "https://ibogaspirit.pl/clients/payment/admin-preview")
        return route.fulfill({
          contentType: "text/html",
          body: `<script>window.addEventListener('message',e=>{if(e.data.type==='isc-invoice-preview:data')document.body.textContent='Synthetic invoice '+e.data.invoice.invoiceNumber});parent.postMessage({type:'isc-invoice-preview:ready'},'*')</script>`,
        });
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      if (q.method() !== "GET") {
        writes.push(q.method() + " " + u.pathname);
        return route.abort();
      }
      if (u.pathname === "/payments/payment961")
        return route.fulfill({
          json: {
            _id: "payment961",
            display_id: 1211,
            amount: 2400,
            currency: "USD",
            paymentDate: "2026-10-27",
            status: "completed",
            paymentMethod: "paypal",
            clientId: client,
            paymentRequestId: "request961",
          },
        });
      if (u.pathname === "/payment-requests/request961") {
        if (unavailable) {
          return route.fulfill({
            status: 503,
            json: { message: "Synthetic unavailable" },
          });
        }
        return route.fulfill({
          json: {
            _id: "request961",
            invoiceNumber: 1365,
            publicHash: "synthetic-private-hash",
            status: blocked ? "cancelled" : "paid",
            clientId: client,
            requestedAmount: 2400,
            currency: "USD",
          },
        });
      }
      if (u.pathname === "/payment-requests/request961/invoice-preview")
        return route.fulfill({
          json: {
            previewOnly: true,
            invoice: {
              invoiceNumber: 1365,
              language: "en",
              currency: "USD",
              depositAmount: 2400,
            },
          },
        });
      if (u.pathname === "/clients") return route.fulfill({ json: [client] });
      if (
        u.pathname === "/retreats" ||
        u.pathname === "/bookings" ||
        u.pathname === "/payment-requests"
      )
        return route.fulfill({ json: [] });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (
        u.pathname.includes("config-summary") ||
        u.pathname.includes("settings") ||
        u.pathname === "/users/navigation-permissions"
      )
        return route.fulfill({ json: {} });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/payments/payment961");
    const actions = page.getByRole("region", {
      name: "Linked online invoice",
      exact: true,
    });
    await expect(
      actions.getByRole("button", { name: "Retry invoice link" }),
    ).toBeVisible();
    unavailable = false;
    await actions.getByRole("button", { name: "Retry invoice link" }).click();
    const link = actions.getByRole("link", {
      name: "Open online invoice",
      exact: true,
    });
    await expect(link).toHaveAttribute(
      "href",
      "https://ibogaspirit.pl/clients/payment/request/synthetic-private-hash?lang=pl",
    );
    await expect(
      actions.getByRole("link", { name: "Open linked payment request" }),
    ).toHaveAttribute("href", "/admin/payment-requests/request961");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as any).copiedInvoice = value;
          },
        },
      });
    });
    await actions.getByRole("button", { name: "Copy invoice link" }).click();
    await expect(actions.getByRole("status")).toContainText(
      "Private invoice link copied.",
    );
    expect(await page.evaluate(() => (window as any).copiedInvoice)).toBe(
      await link.getAttribute("href"),
    );
    await actions
      .getByRole("button", { name: "Preview online invoice (admin)" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Client website invoice preview",
    });
    await expect(
      page
        .frameLocator('iframe[title="Actual client invoice page"]')
        .getByText("Synthetic invoice 1365"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close preview" }).click();
    await actions
      .getByRole("button", { name: "Email invoice link", exact: true })
      .click();
    const heading = page.getByRole("heading", {
      name: "Email invoice link",
      exact: true,
    });
    await expect(heading).toBeVisible();
    const compose = page.locator("div.fixed").filter({ has: heading }).last();
    await expect(compose.locator('input[type="email"]').first()).toHaveValue(
      client.email,
    );
    await expect(compose.locator("textarea").first()).toHaveValue(
      /synthetic-private-hash/,
    );
    expect(writes).toEqual([]);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await actions.scrollIntoViewIfNeeded();
    await actions.screenshot({
      path: `${process.env.PAYMENT_INVOICE_ARTIFACT_DIR || "test-results"}/invoice-${width}.png`,
    });
    blocked = true;
    await page.reload();
    await expect(actions).toContainText("The private invoice link is inactive");
    await expect(
      actions.getByRole("button", { name: "Email invoice link", exact: true }),
    ).toHaveCount(0);
    expect(writes).toEqual([]);
  });
