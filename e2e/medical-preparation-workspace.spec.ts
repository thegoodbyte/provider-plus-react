import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
const file = process.env.PREPARATION_FIXTURE,
  fixture = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Requires the real preparation-workspace auth/API/MongoDB fixture",
);
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });
async function routeBackend(page: Page) {
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
    const u = new URL(r.url()),
      p = u.pathname.replace(/^\/api(?=\/)/, "");
    if (
      p.startsWith("/auth/") ||
      p.startsWith("/medical-preparation") ||
      (p.startsWith("/booking-flow/bookings/") &&
        p.endsWith("/medication-stop-plan")) ||
      p.startsWith("/clients/booking-options") ||
      p.startsWith("/bookings/")
    ) {
      const response = await route.fetch({ url: fixture.url + p + u.search });
      return route.fulfill({ response });
    }
    if (p === "/environment/status")
      return route.fulfill({
        json: { environment: "local", production: false, enabledJobs: [] },
      });
    if (p === "/work-modes")
      return route.fulfill({
        json: { workspace: { activeMode: "" }, sessions: [] },
      });
    if (p.endsWith("/unread-count"))
      return route.fulfill({ json: { count: 0 } });
    return route.fulfill({ json: [] });
  });
}
for (const width of [1440, 390])
  test(`client draft → booking dates → calendar, reload/edit/archive at ${width}px`, async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    Object.assign(
      fixture,
      await (await request.post(fixture.url + "/fixture/reset")).json(),
    );
    await page.setViewportSize({ width, height: 1000 });
    await routeBackend(page);
    await page.goto("/");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("admin@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill(fixture.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toHaveCount(0);
    await page.goto(
      "/admin/medical-preparation?clientId=" + fixture.ids.client,
    );
    await expect(
      page.getByRole("heading", { name: "Medical Preparation", exact: true }),
    ).toBeVisible();
    if (width > 700) {
      await page.getByPlaceholder("Filter menu...").fill("Medical Preparation");
      await expect(
        page.getByRole("button", { name: "Medical Preparation", exact: true }),
      ).toBeVisible();
      await page.getByPlaceholder("Filter menu...").clear();
    }
    await page.getByRole("button", { name: "New preparation plan" }).click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Medication or substance", { exact: true })
      .fill("Magnesium");
    await dialog
      .getByLabel("Category", { exact: true })
      .selectOption("supplement");
    await dialog
      .getByLabel("Advisor instruction", { exact: true })
      .fill(
        "Synthetic advisor instruction: last magnesium on the selected date.",
      );
    await dialog
      .getByLabel("Internal note — never shown to client", { exact: true })
      .fill("PRIVATE_INTERNAL_NOTE");
    await dialog
      .getByRole("button", { name: "Save draft", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Apply to booking" }),
    ).toBeVisible();
    const draftId = new URL(page.url()).searchParams.get("draftId");
    expect(draftId).toBeTruthy();
    await page.reload();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByLabel("Medication or substance", { exact: true }),
    ).toHaveValue("Magnesium");
    await dialog
      .getByLabel("Client booking", { exact: true })
      .selectOption(fixture.ids.booking);
    await dialog.getByRole("button", { name: "Preview booking dates" }).click();
    await expect(dialog.getByText("2026-11-15", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: /Booking #1400/ }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Apply as private booking draft" })
      .click();
    await expect(
      dialog.getByText("This draft was applied.", { exact: false }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("tab", { name: "Calendar", exact: true }).click();
    await page.getByLabel("Calendar month", { exact: true }).fill("2026-11");
    await page.getByRole("button", { name: /2026-11-15:.*Magnesium/ }).click();
    await expect(
      page.getByLabel("Selected preparation instructions"),
    ).toContainText("Client #123");
    const snapshot = await (
      await request.get(fixture.url + "/fixture/snapshot")
    ).json();
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].metadata.planLifecycle).toBe("draft");
    expect(snapshot.schedules).toHaveLength(0);
    expect(snapshot.effects.emails).toHaveLength(0);
    await page.screenshot({
      path: `${process.env.PREPARATION_ARTIFACT_DIR || "test-results"}/calendar-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole('button',{name:'Open preparation item',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Medical Preparation Calendar',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Client #123 · Anna Synthetic',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Booking #1400',exact:true})).toBeVisible();
    await page.getByLabel('Instruction shown to client',{exact:true}).fill('Edited advisor instruction for booking');
    await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByText('Draft saved. It is private until medically approved and explicitly published.',{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByLabel('Instruction shown to client',{exact:true})).toHaveValue('Edited advisor instruction for booking');
    await page.getByText('Archive booking preparation plan',{exact:true}).click();await page.getByLabel('Reason',{exact:true}).fill('Advisor withdrew this booking plan');await page.getByRole('button',{name:'Archive plan',exact:true}).click();await expect(page.getByText('Preparation plan archived. Pending reminders cancelled.',{exact:true})).toBeVisible();
    await page.goto('/admin/medical-preparation?clientId='+fixture.ids.client);
    await expect(page.getByRole("tab", { name: /Items/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "New preparation plan" }).click();
    await expect(page).toHaveURL(/new=1/);
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Medication or substance", { exact: true })
      .fill("Review supplement");
    await dialog
      .getByLabel("Advisor instruction", { exact: true })
      .fill("Synthetic second draft");
    await dialog
      .getByRole("button", { name: "Save draft", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Apply to booking" }),
    ).toBeVisible();
    await dialog.getByLabel("Offset", { exact: true }).fill("7");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      page.getByRole("dialog", {
        name: "Discard unsaved preparation changes?",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await dialog
      .getByRole("button", { name: "Save draft", exact: true })
      .click();
    await expect(dialog.getByLabel("Offset", { exact: true })).toHaveValue("7");
    await page.reload();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Offset", { exact: true })).toHaveValue("7");
    await dialog
      .getByText("Archive this potential plan", { exact: true })
      .click();
    await dialog
      .getByLabel("Archive reason", { exact: true })
      .fill("Advisor withdrew potential instruction");
    await dialog
      .getByRole("button", { name: "Archive draft", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByLabel("Status", { exact: true }).selectOption("archived");
    await expect(page.getByText(/Last dose: Review supplement/)).toBeVisible();
    await page.getByRole('button',{name:'View archived item',exact:true}).first().click();await expect(page.getByRole('dialog',{name:'Archived preparation item'})).toContainText('Edited advisor instruction for booking');await page.getByRole('dialog',{name:'Archived preparation item'}).getByRole('button',{name:'Close',exact:true}).click();
    await page.screenshot({
      path: `${process.env.PREPARATION_ARTIFACT_DIR || "test-results"}/items-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
