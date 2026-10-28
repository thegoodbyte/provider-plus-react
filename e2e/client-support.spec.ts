import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
test.describe.configure({ mode: "serial" });
const file = process.env.CLIENT_SUPPORT_FIXTURE,
  f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {},
  ir = process.env.CLIENT_SUPPORT_IR_URL || "http://127.0.0.1:5046",
  admin = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5047",
  artifacts = process.env.CLIENT_SUPPORT_ARTIFACT_DIR || "test-results/support";
test.skip(
  !file,
  "Requires disposable production-schema Mongo/Nest support fixture",
);
async function routeApi(page: Page, loseFirstSubmit = false) {
  let lose = loseFirstSubmit;
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
    const u = new URL(r.url()),
      path = u.pathname.replace(/^\/api(?=\/)/, "");
    if (
      path.startsWith("/client-portal/support") ||
      path.startsWith("/public/support") ||
      path.startsWith("/tasks") ||
      path === "/auth/client-login"
    ) {
      const response = await route.fetch({ url: f.url + path + u.search });
      if (
        lose &&
        r.method() === "POST" &&
        path === "/client-portal/support/requests"
      ) {
        lose = false;
        return route.abort("timedout");
      }
      return route.fulfill({ response });
    }
    if (path === "/environment/status")
      return route.fulfill({
        json: { environment: "local", production: false, enabledJobs: [] },
      });
    return route.fulfill({ json: [] });
  });
}
for (const width of [1440, 390])
  test(`support direct link, staff privacy, retry, resolve and reopen at ${width}px`, async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    await request.post(f.url + "/fixture/reset");
    const before = await (
      await request.get(f.url + "/fixture/snapshot")
    ).json();
    const staffContext = await browser.newContext({
        viewport: { width, height: 1000 },
      }),
      clientContext = await browser.newContext({
        viewport: { width, height: 1000 },
      });
    try {
      const staff = await staffContext.newPage();
      await staff.addInitScript((token) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: "staff",
            email: "admin@example.invalid",
            role: "admin",
          }),
        );
      }, f.tokens.admin);
      await routeApi(staff);
      await staff.goto(admin + "/admin/tasks?support=all");
      await expect(
        staff.getByRole("heading", { name: "Client support", exact: true }),
      ).toBeVisible();
      await staff
        .getByText("Copy a support link to send to a client", { exact: true })
        .click();
      await staff.getByLabel("Topic", { exact: true }).selectOption("payments");
      await staff.getByLabel("Issue", { exact: true }).selectOption("received");
      await staff.getByLabel("Booking number (optional)").fill("1320");
      const copied = staff.getByLabel("Shareable support link");
      await expect(copied).toHaveValue(
        /\/support\?topic=payments&issue=received&booking=1320$/,
      );
      await staff
        .getByRole("button", { name: "Copy support link", exact: true })
        .click();
      const link = new URL(await copied.inputValue());
      const client = await clientContext.newPage();
      await routeApi(client, true);
      await client.goto(
        ir +
          (width === 390
            ? "/workflow?action=support&" + link.search.slice(1)
            : link.pathname + link.search),
      );
      await expect(client).toHaveURL(/\/login$/);
      await client.getByLabel("Email Address").fill("alice@example.invalid");
      await client.getByLabel("Login PIN").fill("123456");
      await client.getByRole("button", { name: "Login", exact: true }).click();
      await expect(client).toHaveURL(
        /\/support\?topic=payments&issue=received&booking=1320$/,
      );
      await expect(
        client.getByLabel("What do you need help with?"),
      ).toHaveValue("payments");
      await expect(client.getByLabel("What is the issue?")).toHaveValue(
        "received",
      );
      await expect(
        client.getByLabel("Which booking is this about?"),
      ).toHaveValue(f.ids.bookings[0]);
      await expect(client.getByText("Booking number: #1320")).toBeVisible();
      await client
        .getByLabel("Tell us what happened")
        .fill("I paid 2400 USD yesterday. Please check the transaction.");
      await client
        .getByRole("button", { name: "Send request", exact: true })
        .click();
      await expect(client.getByRole("alert")).toContainText(
        "Your message is kept",
      );
      await expect(client.getByLabel("Tell us what happened")).toHaveValue(
        "I paid 2400 USD yesterday. Please check the transaction.",
      );
      await client
        .getByRole("button", { name: "Send request", exact: true })
        .click();
      await expect(client).toHaveURL(/\/support\?request=SUP-/);
      const reference = new URL(client.url()).searchParams.get("request")!;
      await expect(
        client.getByRole("heading", { name: reference, exact: true }),
      ).toBeVisible();
      await client.reload();
      await expect(
        client.getByText(
          "I paid 2400 USD yesterday. Please check the transaction.",
        ),
      ).toBeVisible();
      let data = await (await request.get(f.url + "/fixture/snapshot")).json();
      expect(data.tasks).toHaveLength(1);
      expect(data.emails).toHaveLength(2);
      const id = data.tasks[0]._id;
      await staff.reload();
      await staff.getByRole("button", { name: new RegExp(reference) }).click();
      await expect(
        staff.getByRole("heading", {
          name: reference + " · I have paid — please check",
        }),
      ).toBeVisible();
      await staff
        .getByRole("button", { name: "Internal note", exact: true })
        .click();
      await staff
        .getByLabel("Private staff note")
        .fill("PRIVATE STAFF NOTE: compare original transaction.");
      await expect(
        staff.getByLabel("Notify client by email with a secure link"),
      ).toHaveCount(0);
      await staff
        .getByRole("button", { name: "Preview internal note" })
        .click();
      await staff
        .getByRole("button", { name: "Save internal note", exact: true })
        .click();
      await expect(
        staff.getByText("Private note saved. No client notification."),
      ).toBeVisible();
      await client.reload();
      await expect(
        client.getByText("PRIVATE STAFF NOTE: compare original transaction."),
      ).toHaveCount(0);
      data = await (await request.get(f.url + "/fixture/snapshot")).json();
      expect(data.emails).toHaveLength(2);
      await staff
        .getByRole("button", { name: "Reply to client", exact: true })
        .click();
      await expect(staff.getByLabel("Client-visible reply")).toHaveValue("");
      await staff
        .getByLabel("Client-visible reply")
        .fill(
          "We have reviewed your query. Please see the payment workspace for receipt confirmation.",
        );
      await staff.getByLabel("Resolve request with this reply").check();
      await staff
        .getByRole("button", { name: "Preview reply", exact: true })
        .click();
      await staff
        .getByRole("button", {
          name: "Send reply & notify client",
          exact: true,
        })
        .click();
      await expect(staff.getByLabel("Stage", { exact: true })).toHaveValue(
        "resolved",
      );
      await client.reload();
      await expect(
        client.getByText(
          "We have reviewed your query. Please see the payment workspace for receipt confirmation.",
        ),
      ).toBeVisible();
      await expect(
        client.getByText("Status: Resolved", { exact: true }),
      ).toBeVisible();
      await client
        .getByLabel("Add a reply", { exact: true })
        .fill("One more detail: the transfer reference was SUPPORT-945.");
      await client
        .getByRole("button", { name: "Add a reply", exact: true })
        .click();
      await expect(
        client.getByText("Status: New", { exact: true }),
      ).toBeVisible();
      await staff
        .getByRole("button", { name: "Reload request", exact: true })
        .click();
      await expect(staff.getByLabel("Stage", { exact: true })).toHaveValue(
        "new",
      );
      await staff.getByLabel("Owner email").fill("admin@example.invalid");
      await staff.getByLabel("Stage", { exact: true }).selectOption("team");
      await staff.getByLabel("Next action due (UTC)").fill("2026-12-01");
      await staff
        .getByRole("button", { name: "Save ownership & stage", exact: true })
        .click();
      await expect(
        staff.getByRole("button", {
          name: "Save ownership & stage",
          exact: true,
        }),
      ).toBeEnabled();
      await staff.reload();
      await expect(staff.getByLabel("Stage", { exact: true })).toHaveValue(
        "team",
      );
      await expect(staff.getByLabel("Owner email")).toHaveValue(
        "admin@example.invalid",
      );
      await staff
        .locator(".support-inbox")
        .screenshot({ path: `${artifacts}/support-staff-${width}.png` });
      await client.screenshot({
        path: `${artifacts}/support-client-${width}.png`,
        fullPage: true,
      });
      const safe = await (
        await request.get(f.url + "/client-portal/support/requests/" + id, {
          headers: { Authorization: "Bearer " + f.tokens.alice },
        })
      ).json();
      expect(JSON.stringify(safe)).not.toContain("PRIVATE STAFF NOTE");
      expect(safe.support.deliveries).toBeUndefined();
      expect(
        (
          await request.get(f.url + "/client-portal/support/requests/" + id, {
            headers: { Authorization: "Bearer " + f.tokens.ben },
          })
        ).status(),
      ).toBe(404);
      const after = await (
        await request.get(f.url + "/fixture/snapshot")
      ).json();
      expect(after.tasks).toHaveLength(1);
      expect(after.tasks[0].support.messages).toHaveLength(4);
      expect(after.bookings).toEqual(before.bookings);
      expect(after.clients).toEqual(before.clients);
      expect(after.emails).toHaveLength(4);
      expect(
        after.emails.every(
          (e: any) => !e.bodyText.includes("PRIVATE STAFF NOTE"),
        ),
      ).toBe(true);
    } finally {
      await clientContext.close();
      await staffContext.close();
    }
  });
for (const width of [1440, 390])
  test(`verified account-access support at ${width}px`, async ({
    browser,
    request,
  }) => {
    await request.post(f.url + "/fixture/reset");
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    try {
      const page = await context.newPage();
      await routeApi(page);
      await page.goto(ir + "/support/access");
      await page
        .getByLabel("Email", { exact: true })
        .fill("new@example.invalid");
      await page.getByLabel("Name", { exact: true }).fill("New contact");
      await page
        .getByLabel("Phone with country code (optional)")
        .fill("+48 123 456 789");
      await page.getByLabel("Booking number, if known").fill("1320");
      await page
        .getByLabel("How can we help you sign in?")
        .fill("I cannot find my portal PIN.");
      await page
        .getByRole("button", { name: "Send verification code", exact: true })
        .click();
      await expect(page.getByLabel("Verification code")).toBeVisible();
      const snapshot = await (
        await request.get(f.url + "/fixture/snapshot")
      ).json();
      expect(snapshot.tasks).toHaveLength(0);
      const code = snapshot.emails
        .find((e: any) => e.relatedEntityType === "support_verification")
        .bodyText.match(/\b\d{6}\b/)[0];
      await page.getByLabel("Verification code").fill(code);
      await page
        .getByRole("button", { name: "Verify email", exact: true })
        .click();
      await expect(page.getByRole("heading", { name: /^SUP-/ })).toBeVisible();
      await page.reload();
      await expect(
        page.getByText("I cannot find my portal PIN.", { exact: true }),
      ).toBeVisible();
      await page
        .getByLabel("Reply", { exact: true })
        .fill("Please contact me at the verified email.");
      await page.getByRole("button", { name: "Reply", exact: true }).click();
      await expect(
        page
          .locator(".support-message")
          .filter({ hasText: "Please contact me at the verified email." }),
      ).toBeVisible();
      await expect(page.getByLabel("Reply", { exact: true })).toHaveValue("");
      await page.reload();
      await expect(
        page
          .locator(".support-message")
          .filter({ hasText: "Please contact me at the verified email." }),
      ).toBeVisible();
      await page.screenshot({
        path: `${artifacts}/support-access-${width}.png`,
        fullPage: true,
      });
      const after = await (
        await request.get(f.url + "/fixture/snapshot")
      ).json();
      expect(after.tasks).toHaveLength(1);
      expect(after.tasks[0].clientId).toBeUndefined();
      expect(after.tasks[0].bookingId).toBeUndefined();
      expect(after.tasks[0].support.reportedBooking).toBe("1320");
      expect(after.tasks[0].support.reporterEmail).toBe("new@example.invalid");
    } finally {
      await context.close();
    }
  });
