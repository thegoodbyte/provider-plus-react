import { test, expect, Page } from "@playwright/test";
import { mockNavigationApi } from "./helpers/mock-navigation-api";
// Read-only navigation has deterministic empty APIs. Persistence is covered by real-DB suites.
async function menu(page: Page) {
  if (
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .evaluate((el) => Boolean(el.closest("aside")?.inert))
  )
    await page
      .getByRole("button", { name: "Toggle menu", exact: true })
      .click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
}
async function go(page: Page, label: string) {
  await menu(page);
  await page.getByPlaceholder("Filter menu...").fill(label);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: label, exact: true })
    .last()
    .click();
}
test.beforeEach(async ({ page }) => {
  await mockNavigationApi(page);
});
test("launcher mounts without page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin/launcher");
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("main menu moves between clients, retreats and payments", async ({
  page,
}) => {
  await page.goto("/admin/launcher");
  for (const [label, path] of [
    ["Clients", "clients"],
    ["Retreats", "retreats"],
    ["Payments", "payments"],
  ]) {
    await go(page, label);
    await expect(page).toHaveURL(new RegExp("/admin/" + path + "$"));
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
});
test("navigation opens and closes accessibly at this viewport", async ({
  page,
}) => {
  await page.goto("/admin/launcher");
  await menu(page);
  await expect(page.getByPlaceholder("Filter menu...")).toBeVisible();
  const close = page.getByRole("button", { name: "Close menu", exact: true });
  if (await close.isVisible()) {
    await close.click();
    await expect
      .poll(() =>
        page.locator("aside").evaluate((el) => (el as HTMLElement).inert),
      )
      .toBe(true);
  } else {
    await expect(
      page.getByRole("button", { name: "Collapse sidebar", exact: true }),
    ).toBeVisible();
  }
});
test("history restores the previous screen", async ({ page }) => {
  await page.goto("/admin/clients");
  await go(page, "Retreats");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Clients", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Retreats", exact: true }),
  ).toBeVisible();
});
test("loading a direct link renders content", async ({ page }) => {
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Payments", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Payment", exact: true }),
  ).toBeVisible();
});
test("an unavailable route can recover through menu navigation", async ({
  page,
}) => {
  await page.goto("/admin/nonexistent-page");
  await go(page, "Clients");
  await expect(
    page.getByRole("heading", { name: "Clients", exact: true }),
  ).toBeVisible();
});
test("deep links survive reload", async ({ page }) => {
  for (const label of ["Clients", "Retreats", "Payments"]) {
    await page.goto("/admin/" + label.toLowerCase());
    await page.reload();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
});
test("menu search is keyboard focusable and filters choices", async ({
  page,
}) => {
  await page.goto("/admin/launcher");
  await menu(page);
  const input = page.getByPlaceholder("Filter menu...");
  await input.focus();
  await expect(input).toBeFocused();
  await page.keyboard.type("Clients");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Clients", exact: true })
      .last(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Payments", exact: true }),
  ).toHaveCount(0);
});
test("successive navigation ends on the last chosen page", async ({ page }) => {
  await page.goto("/admin/launcher");
  await go(page, "Clients");
  await go(page, "Retreats");
  await expect(page).toHaveURL(/\/admin\/retreats$/);
  await expect(
    page.getByRole("heading", { name: "Retreats", exact: true }),
  ).toBeVisible();
});
