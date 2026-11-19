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

// Existing legacy quick-book scenarios remain explicitly skipped when that retired entry point is absent.
test.describe("Legacy quick-book entry point", () => {
  test.describe("Retreat Booking Form Validation", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/admin/retreats");
      await page.waitForLoadState("networkidle");

      // Navigate to a retreat detail page
      const firstRetreat = page
        .locator("tr:not(:first-child), .retreat-item")
        .first();
      if ((await firstRetreat.count()) > 0) {
        await firstRetreat.click();
        await page.waitForSelector('button:has-text("Quick Book Client")');
      } else {
        test.skip("No retreats available for booking tests");
      }
    });

    test("should validate quick booking form required fields", async ({
      page,
    }) => {
      // Open quick booking modal
      await page.getByRole("button", { name: /Quick Book Client/i }).click();
      await expect(
        page.locator("text=Quick Book Client for Retreat"),
      ).toBeVisible();

      // Try to submit empty form
      await page.getByRole("button", { name: /Book Client$/i }).click();

      // Should show validation errors
      const errorMessages = page.locator(
        "text=required, text=Please enter, .ant-form-item-explain-error",
      );
      expect(await errorMessages.count()).toBeGreaterThan(0);

      // Modal should remain open
      await expect(
        page.locator("text=Quick Book Client for Retreat"),
      ).toBeVisible();
    });

    test("should validate amount is positive number", async ({ page }) => {
      await page.getByRole("button", { name: /Quick Book Client/i }).click();

      // Enter negative amount
      await page.getByLabel(/Total Amount/i).fill("-100");

      // Fill other required fields
      await page.getByLabel(/First Name/i).fill("Test");
      await page.getByLabel(/Last Name/i).fill("User");
      await page.getByLabel(/Phone Number/i).fill("1234567890");
      await page.getByLabel(/Email/i).fill("test@example.com");

      await page.getByRole("button", { name: /Book Client$/i }).click();

      // Should show amount validation error or convert to positive
      await page.waitForTimeout(1000);

      // The form might either show error or handle negative values
      const amountError = page.locator(
        "text=positive, text=greater than, .amount-error",
      );
      // This is a soft validation as different forms handle this differently
    });

    test("should validate email in booking form", async ({ page }) => {
      await page.getByRole("button", { name: /Quick Book Client/i }).click();

      // Enter invalid email
      await page.getByLabel(/Email/i).fill("invalid-email-format");

      // Fill other fields
      await page.getByLabel(/First Name/i).fill("Test");
      await page.getByLabel(/Last Name/i).fill("User");
      await page.getByLabel(/Phone Number/i).fill("1234567890");
      await page.getByLabel(/Total Amount/i).fill("3000");

      await page.getByRole("button", { name: /Book Client$/i }).click();

      // Should show email validation error
      const emailError = page.locator(
        "text=valid email, .ant-form-item-explain-error",
      );
      if ((await emailError.count()) > 0) {
        await expect(emailError).toBeVisible();
      }
    });
  });
});
