import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixturePath = process.env.WORK_MODES_FIXTURE;
const fixture: any = fixturePath
  ? JSON.parse(fs.readFileSync(fixturePath, "utf8"))
  : {};
test.skip(!fixturePath, "Requires isolated PPVC-835 fixture");
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`persisted medical session and recovery ${width}`, async ({
    page,
    request,
  }) => {
    await request.post(fixture.url + "/fixture/reset");
    await page.setViewportSize({ width, height: 950 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "a",
          email: "a@example.invalid",
          role: "admin",
          firstName: "Test",
        }),
      );
    }, fixture.tokens.a);
    await page.route("**/*", async (route) => {
      const req = route.request();
      if (!["xhr", "fetch"].includes(req.resourceType()))
        return route.continue();
      const path = new URL(req.url()).pathname;
      if (
        path.startsWith("/work-modes") ||
        /^\/medical-artifacts\/[0-9a-f]+$/.test(path)
      ) {
        const response = await route.fetch({ url: fixture.url + path });
        return route.fulfill({ response });
      }
      if (path === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (path.includes("ai-health"))
        return route.fulfill({ json: { healthy: true } });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/work-modes");
    await expect(
      page.getByRole("heading", { name: "Current queues" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Enter focused navigation" })
      .click();
    await expect(page.getByLabel("Active work mode")).toBeVisible();
    await page.getByRole("button", { name: "Start first 5" }).click();
    await expect(
      page.getByText("Batch size: 5.", { exact: false }),
    ).toBeVisible();
    const sessionUrl = page.url();
    const sessionId = sessionUrl.split("/").pop()!;
    const counts = async (key: string, value: string) =>
      expect(
        page
          .locator(".wm-counts div")
          .filter({ has: page.locator("dt", { hasText: key }) })
          .locator("dd"),
      ).toHaveText(value);
    const note = page.getByLabel("Short operational note (no medical details)");
    await note.fill("Reviewed existing operational context");
    await page
      .getByRole("button", { name: "Save review outcome and advance" })
      .click();
    await counts("Reviewed by you", "1");
    await page.getByLabel("Outcome", { exact: true }).selectOption("skip");
    await page.getByRole("button", { name: "Save skip and advance" }).click();
    await counts("Skipped", "1");
    await page.getByLabel("Outcome", { exact: true }).selectOption("block");
    await page.getByRole("button", { name: "Save block and advance" }).click();
    await counts("Blocked", "1");
    await page.reload();
    await counts("Reviewed by you", "1");
    await counts("Remaining", "2");
    await request.post(fixture.url + "/fixture/arrival");
    await page
      .getByRole("button", { name: "Refresh queue and progress" })
      .click();
    await expect(
      page.getByRole("heading", { name: "New arrivals · 1" }),
    ).toBeVisible();
    await expect(
      page.getByText("Batch size: 5.", { exact: false }),
    ).toBeVisible();
    await page.locator("input[type=checkbox]").check();
    await page
      .getByRole("button", { name: "Add selected arrivals (1)" })
      .click();
    await expect(
      page.getByText("Batch size: 6.", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Open source editor", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: /Medical Artifact #/ }),
    ).toBeVisible();
    await expect(page).toHaveURL(/returnTo=/);
    await page.getByRole("link", { name: "Return to work session" }).click();
    await expect(page).toHaveURL(sessionUrl);
    await counts("Remaining", "3");
    await page
      .getByLabel("Short operational note (no medical details)")
      .fill("Retain this exact operational draft");
    await request.post(fixture.url + "/fixture/fail-next");
    await page
      .getByRole("button", { name: "Save review outcome and advance" })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Synthetic save failure" }),
    ).toBeVisible();
    await counts("Reviewed by you", "1");
    await expect(
      page.getByLabel("Short operational note (no medical details)"),
    ).toHaveValue("Retain this exact operational draft");
    await page
      .getByRole("button", { name: "Save review outcome and advance" })
      .click();
    await counts("Reviewed by you", "2");
    const live = await (
      await request.get(fixture.url + "/work-modes/sessions/" + sessionId, {
        headers: { authorization: "Bearer " + fixture.tokens.a },
      })
    ).json();
    await request.post(
      fixture.url + "/fixture/external/" + live.current.source.sourceId,
    );
    await page
      .getByRole("button", { name: "Refresh queue and progress" })
      .click();
    await counts("Resolved outside this session", "1");
    await counts("Reviewed by you", "2");
    await page.getByRole("button", { name: "Take a break" }).click();
    await expect(
      page.getByRole("heading", { name: "Medical session · paused" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Medical session · paused" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Resume session", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Medical session · active" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Finish session", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm finish", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Medical session · finished" }),
    ).toBeVisible();
    // Keyboard-accessible exit restores ordinary navigation.
    const exit = page.getByRole("button", { name: "Exit work mode" });
    await exit.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Active work mode")).toHaveCount(0);
    await page.screenshot({
      path: `../ppvc-835-validation/session-${width}.png`,
      fullPage: true,
    });
    const denied = await request.get(fixture.url + "/work-modes/queue", {
      headers: { authorization: "Bearer " + fixture.tokens.staff },
    });
    expect(denied.status()).toBe(403);
  });
