import { test, expect } from "./fixtures/payment-workspace";
import { dismissFeedback } from "./fixtures/booking-room";
test.beforeEach(async ({ paymentWorkspace }) => {
  expect(paymentWorkspace.tokens.admin).toBeTruthy();
});
test("payment grid shows numbered records", async ({ page }) => {
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Payments", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
test("add payment opens the dedicated editor", async ({ page }) => {
  await page.goto("/admin/payments");
  await page.getByRole("button", { name: "Add Payment", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/payments\/new$/);
  await expect(
    page.getByRole("spinbutton", { name: "Amount", exact: true }),
  ).toBeVisible();
});
test("cancel returns without writing a payment", async ({
  page,
  paymentWorkspace: f,
}) => {
  await page.goto("/admin/payments/new");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  expect(await f.models.Payment.countDocuments()).toBe(3);
});
test("creates a payment for an exact booking and reloads it", async ({
  page,
  paymentWorkspace: f,
}) => {
  await page.goto("/admin/payments/new");
  await page
    .getByRole("textbox", { name: "Payment client", exact: true })
    .fill("330");
  await page.getByText("Anna Synthetic", { exact: true }).last().click();
  await page
    .getByRole("combobox", { name: "Search and select booking", exact: true })
    .fill("9501");
  await page.getByRole("option", { name: /#9501/ }).click();
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("100");
  await page.getByLabel("Currency", { exact: true }).selectOption("PLN");
  await page.getByLabel("Status", { exact: true }).selectOption("completed");
  await dismissFeedback(page);
  await page.getByRole("button", { name: "Add Payment", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  const saved = await f.models.Payment.findOne({ amount: 100 }).lean();
  expect(String(saved.bookingId)).toBe("000000000000000000001001");
  expect(await f.models.Payment.countDocuments()).toBe(4);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(4);
});
test("search filters by payment number and clears", async ({ page }) => {
  await page.goto("/admin/payments");
  await page
    .getByRole("searchbox", { name: "Search payments", exact: true })
    .fill("1201");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Clear payment search", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
test("completed statistics agree with seeded records", async ({ page }) => {
  await page.goto("/admin/payments");
  await expect(
    page.getByText("Total: 3 completed", { exact: true }),
  ).toBeVisible();
});
test("edit action opens the correct numbered payment", async ({
  page,
  paymentWorkspace: f,
}) => {
  await page.goto("/admin/payments");
  await page
    .locator("tbody tr")
    .filter({ hasText: "#1201" })
    .getByTitle("Edit", { exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp("/admin/payments/" + f.ids.payments[1] + "/edit$"),
  );
  await expect(
    page.getByRole("spinbutton", { name: "Amount", exact: true }),
  ).toHaveValue("600");
});
test("cancelled deletion leaves every payment unchanged", async ({
  page,
  paymentWorkspace: f,
}) => {
  const before = JSON.stringify(
    await f.models.Payment.find().sort({ _id: 1 }).lean(),
  );
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.goto("/admin/payments");
  await page
    .locator("tbody tr")
    .first()
    .getByTitle("Delete", { exact: true })
    .click();
  expect(
    JSON.stringify(await f.models.Payment.find().sort({ _id: 1 }).lean()),
  ).toBe(before);
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
for (const width of [390, 768])
  test(`payment controls and rows remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/admin/payments");
    await expect(
      page.getByRole("button", { name: "Add Payment", exact: true }),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("payments.png"),
      fullPage: true,
    });
  });
