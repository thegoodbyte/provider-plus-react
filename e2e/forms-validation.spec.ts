import { test, expect } from "./fixtures/client-workspace";
import { openClientForm, fillClientForm } from "./fixtures/client-form";

// Each test owns a disposable database with the production client controller,
// service, schemas and indexes. No conditional success when a selector is missing.
test.beforeEach(async ({ clientWorkspace }) => {
  expect(clientWorkspace.token).toBeTruthy();
});

test("should validate required fields in client creation", async ({
  page,
  clientWorkspace: f,
}) => {
  const dialog = await openClientForm(page);
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "First name, last name, and phone are required.",
  );
  await expect(dialog).toBeVisible();
  expect(await f.models.Client.countDocuments()).toBe(2);
});
test("should validate email format", async ({ page, clientWorkspace: f }) => {
  await openClientForm(page);
  const dialog = await fillClientForm(page, "InvalidEmail");
  await dialog.getByLabel("Email", { exact: true }).fill("invalid-email");
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Enter a valid email address.",
  );
  expect(await f.models.Client.countDocuments()).toBe(2);
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("valid@example.invalid");
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    await f.models.Client.countDocuments({ email: "valid@example.invalid" }),
  ).toBe(1);
});
test("should validate display_id uniqueness", async ({
  page,
  clientWorkspace: f,
}) => {
  await openClientForm(page);
  const dialog = await fillClientForm(page, "DuplicateId");
  await dialog.getByLabel("Client ID", { exact: true }).fill("9791");
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(await f.models.Client.countDocuments()).toBe(2);
  expect(
    (await f.models.Client.findOne({ display_id: 9791 }).lean()).firstName,
  ).toBe("Ewa");
  await dialog.getByLabel("Client ID", { exact: true }).fill("9801");
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(await f.models.Client.countDocuments({ display_id: 9801 })).toBe(1);
});
test("should validate phone number format", async ({
  page,
  clientWorkspace: f,
}) => {
  await openClientForm(page);
  const dialog = await fillClientForm(page, "FormattedPhone");
  await dialog.getByLabel("Phone *", { exact: true }).fill("+48 (728) 919-205");
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const saved = await f.models.Client.findOne({
    lastName: "FormattedPhone",
  }).lean();
  expect(saved.phone.replace(/\D/g, "")).toBe("48728919205");
  expect(await f.models.Client.countDocuments()).toBe(3);
  await page.reload();
  await expect(
    page.getByRole("cell", { name: "Synthetic FormattedPhone", exact: true }),
  ).toBeVisible();
});
test("should handle empty search gracefully", async ({ page }) => {
  await page.goto("/admin/clients");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Search clients", exact: true })
    .fill("Ewa");
  await expect(rows).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Search clients", exact: true })
    .fill("");
  await expect(rows).toHaveCount(2);
});
test("should handle search with no results", async ({ page }) => {
  await page.goto("/admin/clients");
  await page
    .getByRole("textbox", { name: "Search clients", exact: true })
    .fill("XYZ_NONEXISTENT_CLIENT_NAME_12345");
  await expect(
    page.getByText("No clients found", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "Ewa" })).toHaveCount(
    0,
  );
});
test("should validate searchable client selector", async ({ page }) => {
  await page.goto("/admin/bookings/new");
  const search = page.getByPlaceholder("Search and select a client...", {
    exact: true,
  });
  await expect(search).toBeVisible();
  await search.fill("!@#$%^&*()");
  await expect(page.getByText(/No clients found/)).toBeVisible();
  await search.fill("a".repeat(100));
  await expect(page.getByText(/No clients found/)).toBeVisible();
  await search.fill("Ewa");
  await expect(
    page.getByText("Ewa Fixture", { exact: false }).last(),
  ).toBeVisible();
});
test("should handle network failures gracefully", async ({
  page,
  clientWorkspace: f,
}) => {
  await openClientForm(page);
  const dialog = await fillClientForm(page, "NetworkFailure");
  await page.route("**/clients/quick-add", (route) => route.abort("failed"));
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    /connection|network|save/i,
  );
  await expect(dialog.getByLabel("Last Name *", { exact: true })).toHaveValue(
    "NetworkFailure",
  );
  expect(await f.models.Client.countDocuments()).toBe(2);
});
test("should retry failed requests appropriately", async ({
  page,
  clientWorkspace: f,
}) => {
  await openClientForm(page);
  const dialog = await fillClientForm(page, "Retried");
  let calls = 0;
  await page.route("**/clients/quick-add", async (route) => {
    calls++;
    if (calls === 1)
      return route.fulfill({
        status: 503,
        json: { message: "Synthetic save outage" },
      });
    return route.fallback();
  });
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Last Name *", { exact: true })).toHaveValue(
    "Retried",
  );
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(calls).toBe(2);
  expect(await f.models.Client.countDocuments({ lastName: "Retried" })).toBe(1);
});
test("should have proper form focus management", async ({ page }) => {
  await page.goto("/admin/clients");
  const trigger = page.getByRole("button", { name: "Add Client", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Add New Client",
    exact: true,
  });
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Create Client", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("should provide helpful error messages", async ({ page }) => {
  const dialog = await openClientForm(page);
  await dialog
    .getByRole("button", { name: "Create Client", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "First name, last name, and phone are required.",
  );
  await expect(
    dialog.getByRole("heading", { name: "Add New Client", exact: true }),
  ).toBeVisible();
});
test("should handle form submission states correctly", async ({
  page,
  clientWorkspace: f,
}) => {
  await openClientForm(page);
  const dialog = await fillClientForm(page, "SingleSubmit");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route("**/clients/quick-add", async (route) => {
    writes++;
    await gate;
    return route.fallback();
  });
  const submit = dialog.getByRole("button", {
    name: "Create Client",
    exact: true,
  });
  await submit.click();
  await expect(submit).toBeDisabled();
  await submit.dispatchEvent("click");
  expect(writes).toBe(1);
  release();
  await expect(dialog).toHaveCount(0);
  expect(
    await f.models.Client.countDocuments({ lastName: "SingleSubmit" }),
  ).toBe(1);
  expect(await f.models.Client.countDocuments()).toBe(3);
});

// Retired quick-book trigger is no longer rendered in RetreatDetailView.
// Its required-room, amount and client-email scenarios are mapped to the active
// real-API booking and client-form suites in docs/testing/coverage-resolution.md.
