import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixturePath = process.env.INTEGRATION_CALLS_FIXTURE;
const fixture = fixturePath
  ? JSON.parse(readFileSync(fixturePath, "utf8"))
  : {};
test.skip(
  !fixturePath,
  "Requires the isolated PPVC-889 real-Mongo fixture, never production data.",
);
test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    localStorage.setItem("token", "synthetic-integration-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "fixture-admin",
        role: "admin",
        email: "admin@example.invalid",
      }),
    );
  });
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (
      u.origin === new URL(baseURL!).origin &&
      !u.pathname.startsWith("/api/")
    )
      return route.continue();
    const p = u.pathname.replace(/^\/api(?=\/)/, "");
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": baseURL!,
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
    if (
      p.startsWith("/integration/") ||
      p.startsWith("/clients/") ||
      p.startsWith("/retreat-clients") ||
      p.startsWith("/retreats/")
    ) {
      const response = await route.fetch({ url: fixture.url + p + u.search });
      return route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "access-control-allow-origin": baseURL!,
          "access-control-allow-credentials": "true",
        },
      });
    }
    return route.fulfill({
      json:
        p === "/environment/status"
          ? { production: false }
          : ["/config-summary", "/users/navigation-permissions"].includes(p)
            ? {}
            : p.endsWith("/unread-count")
              ? { count: 0 }
              : [],
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
});
for (const width of [1440, 390])
  test(`direct call, guided notes, save/reload and calendar at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/integration");
    await expect(
      page.getByRole("heading", { name: "Integration Calls", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Record a call now", exact: true })
      .click();
    await page.getByLabel("Find clients", { exact: true }).fill("Ewa Fixture");
    await page.getByLabel(/#88901 Ewa Fixture/).check();
    await page
      .getByLabel("Starts (Europe/Prague)", { exact: true })
      .fill(`${fixture.month}-${width === 1440 ? "09" : "10"}T15:00`);
    await page.getByRole("button", { name: "Save and open notes" }).click();
    await expect(
      page.getByRole("heading", { name: "Call notes", exact: true }),
    ).toBeFocused();
    await page
      .getByText("Optional conversation prompts", { exact: true })
      .click();
    await expect(
      page.getByText("What one manageable next step do we agree on?"),
    ).toBeVisible();
    const notes = page.getByLabel("Ewa Fixture · Private staff notes", {
      exact: true,
    });
    const text = `Synthetic ${width}px support notes; no real client information`;
    await notes.fill(text);
    await expect(notes.locator("..").getByRole("status")).toHaveText("Saved", {
      timeout: 10000,
    });
    await expect(
      page.getByLabel("Integration call", { exact: true }),
    ).toBeDisabled();
    const data = await (
      await request.get(
        `${fixture.url}/integration/calendar?clientId=${fixture.clientId}&from=${fixture.month}-01&to=${fixture.month}-28`,
      )
    ).json();
    const call = data.calls.find((c: any) => c.participants[0].notes === text);
    expect(call).toBeTruthy();
    expect(call.retreatId).toBeFalsy();
    expect(call.participants[0].bookingId).toBeFalsy();
    await page.screenshot({
      path: `../ppvc-889-validation/notes-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Back to calls" }).click();
    await page.getByRole("button", { name: "Calendar", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Monthly integration calendar" }),
    ).toBeVisible();
    await page.screenshot({
      path: `../ppvc-889-validation/calendar-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "List", exact: true }).click();
    const card = page
      .locator(".call-card")
      .filter({ hasText: "Individual support call" })
      .last();
    await card.getByRole("button", { name: "Start notes" }).click();
    await expect(
      page.getByLabel("Ewa Fixture · Private staff notes", { exact: true }),
    ).toHaveValue(text);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("client and booking tabs use their own call scope", async ({ page }) => {
  await page.goto(`/admin/clients/${fixture.clientId}`);
  await page.getByRole("button", { name: "Integration", exact: true }).click();
  await expect(
    page.getByText("Direct support fixture", { exact: true }).first(),
  ).toBeVisible();
  await page.goto(`/admin/bookings/${fixture.bookingId}`);
  await page.getByRole("tab", { name: "Integration", exact: true }).click();
  await expect(page.locator(".call-card")).toHaveCount(1);
});

test("group confirmation checkboxes persist separately from actual attendance", async ({
  page,
  request,
}) => {
  await page.goto("/admin/integration");
  await page
    .getByRole("button", { name: "Schedule call", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("group");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Synthetic group confirmation");
  await page
    .getByLabel("Starts (Europe/Prague)", { exact: true })
    .fill(`${fixture.month}-07T16:00`);
  await page.getByLabel("Find clients", { exact: true }).fill("Fixture");
  await page.getByLabel(/#88901 Ewa Fixture/).check();
  await page.getByLabel(/#88902 Other Fixture/).check();
  await page.getByLabel("Ewa Fixture will attend", { exact: true }).check();
  await expect(
    page.getByLabel("Other Fixture will attend", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Save call", exact: true }).click();
  const card = page
    .locator(".call-card")
    .filter({ hasText: "Synthetic group confirmation" });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Details / edit" }).click();
  await expect(
    page.getByLabel("Ewa Fixture will attend", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Other Fixture will attend", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("Ewa Fixture will attend", { exact: true }).uncheck();
  await page.getByLabel("Other Fixture will attend", { exact: true }).check();
  await page.getByRole("button", { name: "Save call", exact: true }).click();
  await expect(page.getByRole('form', { name: 'Call details' })).toBeHidden();
  const data = await (
    await request.get(
      `${fixture.url}/integration/calendar?from=${fixture.month}-01&to=${fixture.month}-28`,
    )
  ).json();
  const saved = data.calls.find(
    (c: any) => c.title === "Synthetic group confirmation",
  );
  expect(saved.participants).toHaveLength(2);
  expect(
    saved.participants.find((p: any) => p.name === "Ewa Fixture").willAttend,
  ).toBe(false);
  expect(
    saved.participants.find((p: any) => p.name === "Other Fixture").willAttend,
  ).toBe(true);
  expect(
    saved.participants.every((p: any) => p.attendance === "not_recorded"),
  ).toBe(true);
});
