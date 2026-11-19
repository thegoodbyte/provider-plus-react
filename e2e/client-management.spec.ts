import { test, expect } from "./fixtures/client-workspace";
import { openClientForm, fillClientForm } from "./fixtures/client-form";
// Each browser/device owns a fresh production-schema database; never a private snapshot.
test.beforeEach(async ({ clientWorkspace }) => {
  expect(clientWorkspace.token).toBeTruthy();
});
test("displays client identity and actions", async ({ page }) => {
  await page.goto("/admin/clients");
  await expect(
    page.getByRole("heading", { name: "Clients", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "ID", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Name", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Client", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("creates a client with a unique generated number and reloads it", async ({
  page,
  clientWorkspace: f,
}) => {
  await openClientForm(page);
  const d = await fillClientForm(page, "Generated");
  await d.getByRole("button", { name: "Create Client", exact: true }).click();
  await expect(d).toHaveCount(0);
  const saved = await f.models.Client.findOne({ lastName: "Generated" }).lean();
  expect(saved.display_id).toBeGreaterThan(9792);
  expect(
    await f.models.Client.countDocuments({ display_id: saved.display_id }),
  ).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("cell", { name: "Synthetic Generated", exact: true }),
  ).toBeVisible();
});
test("manual number override persists without changing a sibling", async ({
  page,
  clientWorkspace: f,
}) => {
  const before = JSON.stringify(
    await f.models.Client.findById(f.ids.sibling).lean(),
  );
  await openClientForm(page);
  const d = await fillClientForm(page, "Manual");
  await d.getByLabel("Client ID", { exact: true }).fill("9999");
  await d.getByRole("button", { name: "Create Client", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(
    (await f.models.Client.findOne({ lastName: "Manual" }).lean()).display_id,
  ).toBe(9999);
  expect(
    JSON.stringify(await f.models.Client.findById(f.ids.sibling).lean()),
  ).toBe(before);
});
test("searches by number, name and phone without depending on another test", async ({
  page,
}) => {
  await page.goto("/admin/clients");
  for (const value of ["9791", "Ewa", "555 100"]) {
    await page
      .getByRole("textbox", { name: "Search clients", exact: true })
      .fill(value);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("Ewa Fixture");
  }
});
test("edits client number and reads back the persisted value", async ({
  page,
  clientWorkspace: f,
}) => {
  await f.models.Client.updateOne(
    { _id: f.ids.client },
    { $set: { loginPin: "739284" } },
  );
  await page.goto("/admin/clients");
  await page
    .locator("tbody tr")
    .filter({ hasText: "Ewa Fixture" })
    .getByTitle("Edit", { exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Edit Client", exact: true });
  await d.getByLabel("Client ID", { exact: true }).fill("9888");
  await d.getByRole("button", { name: "Update Client", exact: true }).click();
  await expect(d).toHaveCount(0);
  await page.reload();
  expect((await f.models.Client.findById(f.ids.client).lean()).display_id).toBe(
    9888,
  );
  await expect(
    page.locator("tbody tr").filter({ hasText: "Ewa Fixture" }),
  ).toContainText("9888");
});
test("filters by actual workflow status", async ({ page }) => {
  await page.goto("/admin/clients");
  await page
    .getByLabel("Filter clients by status", { exact: true })
    .selectOption("screening_scheduled");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Ewa Fixture");
  await page
    .getByLabel("Filter clients by status", { exact: true })
    .selectOption("all");
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("opens client details and returns to the index", async ({ page }) => {
  await page.goto("/admin/clients");
  await page.getByRole("cell", { name: "Ewa Fixture", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ewa Fixture", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Clients", exact: true }),
  ).toBeVisible();
});
test("client grid remains usable at the project viewport", async ({
  page,
}, info) => {
  await page.goto("/admin/clients");
  await expect(
    page.getByRole("cell", { name: "Ewa Fixture", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Client", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("clients.png"),
    fullPage: true,
  });
});
