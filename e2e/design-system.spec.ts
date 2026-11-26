import { test, expect } from "@playwright/test";
import { mockNavigationApi } from "./helpers/mock-navigation-api";
const dev =
  process.env.PLAYWRIGHT_FIXTURE_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://localhost:3000";
for (const width of [1440, 390])
  test(`shared theme, truthful statuses and keyboard dialog at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(dev + "/e2e/fixtures/design-system.html");
    const primary = page.getByRole("button", {
      name: "Review booking",
      exact: true,
    });
    await expect(primary).toHaveCSS("background-color", "rgb(57, 78, 216)");
    await expect(
      page.getByRole("button", { name: "Unavailable action" }),
    ).toBeDisabled();
    await expect(page.getByLabel("Client email")).toHaveCSS(
      "border-radius",
      "12px",
    );
    await expect(page.getByLabel("Invalid email")).toHaveCSS(
      "border-color",
      "rgb(199, 53, 44)",
    );
    await expect(page.getByLabel("Disabled email")).toBeDisabled();
    await expect(
      page.getByText("Balance due €2,450", { exact: true }).first(),
    ).toHaveCSS("color", "rgb(153, 86, 0)");
    await expect(page.getByText("Contract signed", { exact: true })).toHaveCSS(
      "color",
      "rgb(20, 116, 71)",
    );
    expect(
      await page
        .locator("body")
        .evaluate((x) => x.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await primary.click();
    const dialog = page.getByRole("dialog", {
      name: "Review booking",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toBeFocused();
    await dialog
      .getByRole("button", { name: "Close review", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(primary).toBeFocused();
    await page.getByRole("combobox", { name: "Retreat", exact: true }).click();
    await expect(
      page.getByText("Spring retreat", { exact: true }).last(),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`shared-${width}.png`),
      fullPage: true,
    });
  });
for (const width of [1440, 390])
  test(`real administrative sections share the shell palette at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockNavigationApi(page);
    for (const [path, title] of Object.entries({
      clients: "Clients",
      bookings: "Bookings",
      houses: "Houses Management",
      "medical-dashboard": "Medical Dashboard",
      payments: "Payments",
      tasks: "Tasks",
      communications: "Communications",
      "audit-logs": "Audit Logs",
    })) {
      await page.goto("/admin/" + path);
      const main = page.locator("#workspace-content");
      await expect(main).toBeVisible();
      await expect(
        main.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("textbox", { name: "Global search", exact: true }),
      ).toHaveCSS("border-top-width", "0px");
      await expect(main).toHaveCSS("background-color", "rgb(250, 249, 246)");
      expect(
        await main.evaluate((x) => x.scrollWidth <= x.clientWidth + 1),
      ).toBe(true);
      if (path === "tasks") {
        await expect(
          page.getByRole("link", { name: "Operational tasks", exact: true }),
        ).toHaveCSS("background-color", "rgb(57, 78, 216)");
        await expect(
          page.getByRole("button", { name: "List", exact: true }),
        ).toHaveCSS("background-color", "rgb(57, 78, 216)");
      }
      await page.screenshot({
        path: info.outputPath(`${path}-${width}.png`),
        fullPage: true,
      });
    }
  });
