import { test, expect } from "./fixtures/retreat-read-workspace";
async function detail(page: any, f: any) {
  await page.goto("/admin/retreats/" + f.retreat._id);
  await page.getByRole("tab", { name: /^Clients \(2\)$/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Clients · 2 active",
      exact: true,
    }),
  ).toBeVisible();
}
test.beforeEach(async ({ retreatRead }) => {
  expect(retreatRead.retreat._id).toBeTruthy();
});
test("retreat index shows the seeded retreat", async ({ page }) => {
  await page.goto("/admin/retreats");
  await expect(
    page.getByRole("heading", { name: "Retreats", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("COV-2099", { exact: true }).first(),
  ).toBeVisible();
});
test("retreat detail shows both active clients", async ({
  page,
  retreatRead: f,
}) => {
  await detail(page, f);
  await expect(page.getByText("Ewa Coverage", { exact: true })).toBeVisible();
  await expect(page.getByText("Adam Coverage", { exact: true })).toBeVisible();
});
test("current booking entry replaces the retired quick-book trigger", async ({
  page,
  retreatRead: f,
}) => {
  await detail(page, f);
  await expect(
    page.getByRole("button", { name: "Quick Book Client", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add existing client", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: /Add Existing Client to Retreat$/ }),
  ).toBeVisible();
});
test("existing client selector searches by name", async ({
  page,
  retreatRead: f,
}) => {
  await detail(page, f);
  await page
    .getByRole("button", { name: "Add existing client", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("textbox").fill("Ewa");
  await expect(d).toContainText("Ewa Coverage");
  await expect(d).not.toContainText("Adam Coverage");
});
test("existing client selector searches by client number", async ({
  page,
  retreatRead: f,
}) => {
  await detail(page, f);
  await page
    .getByRole("button", { name: "Add existing client", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByRole("textbox").fill("1334");
  await expect(d).toContainText("Adam Coverage");
  await expect(d).not.toContainText("Ewa Coverage");
});
test("client list exposes current financial badges", async ({
  page,
  retreatRead: f,
}) => {
  await detail(page, f);
  await expect(
    page.getByRole("heading", {
      name: "Clients · 2 active",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Balance 1000/).first()).toBeVisible();
});
test("retreat section selection survives reload", async ({
  page,
  retreatRead: f,
}) => {
  await detail(page, f);
  await page.getByRole("tab", { name: "Payments", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Payments", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Payments", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("stay planner is reachable inside clients", async ({
  page,
  retreatRead: f,
}) => {
  await detail(page, f);
  await page.getByRole("button", { name: "Stay planner", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stay planner", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Client list", exact: true }).click();
  await expect(page.getByText("Ewa Coverage", { exact: true })).toBeVisible();
});
test("client actions remain usable at a narrow viewport", async ({
  page,
  retreatRead: f,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await detail(page, f);
  await expect(
    page.getByRole("button", { name: "Add existing client", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("retreat-clients.png"),
    fullPage: true,
  });
});
