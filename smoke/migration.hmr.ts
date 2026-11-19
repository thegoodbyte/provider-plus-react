import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const portal = false;
test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    if (url.pathname.includes("/auth/login"))
      return route.fulfill({
        status: 401,
        json: { message: "Invalid credentials" },
      });
    return route.fulfill({ json: {} });
  });
});
test("Vite hot reload updates CSS without reloading the page", async ({
  page,
}) => {
  if (process.env.SMOKE_DEV !== "true")
    throw new Error("HMR coverage requires the Vite development server");
  const file = resolve("src/index.css");
  const original = readFileSync(file, "utf8");
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.evaluate(() => {
    (window as any).__hmrMarker = "preserved";
  });
  try {
    writeFileSync(file, original + "\nbody { --ppvc644-hmr: updated; }\n");
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.body)
            .getPropertyValue("--ppvc644-hmr")
            .trim(),
        ),
      )
      .toBe("updated");
    expect(await page.evaluate(() => (window as any).__hmrMarker)).toBe(
      "preserved",
    );
  } finally {
    writeFileSync(file, original);
  }
});
