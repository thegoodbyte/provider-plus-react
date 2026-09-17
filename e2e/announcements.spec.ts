import { test, expect } from "@playwright/test";
const retreatId = "507f1f77bcf86cd799439011";
const template = {
  _id: "507f1f77bcf86cd799439012",
  name: "Thank you for participating",
  language: "pl",
  subject: "Thank you",
  bodyText: "Hello {{client.firstName}}, thank you for joining us.",
  attachmentAssetIds: ["one", "two", "three"],
};
test("announcement wizard, retreat timeline and failure history", async ({
  page,
}) => {
  let rules: any[] = [];
  let enabled = false;
  let saved: any;
  let safety = { enabled: true, recipient: 'info@ibogaspirit.cz' };
  let testBooking: string | undefined;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin ===
        new URL(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000")
          .origin &&
      !url.pathname.startsWith("/api/")
    )
      return route.continue();
    const path = url.pathname.replace(/^\/api/, "");
    if (path === '/communications/email-safety') {
      if (route.request().method() === 'PATCH') safety = route.request().postDataJSON();
      return route.fulfill({ json: safety });
    }
    if (path === '/communications/settings') return route.fulfill({ json: {} });
    if (path === '/client-contracts/gate-settings') return route.fulfill({ json: {
      enabled: true, preContractModules: [], portalAccessByStatus: {},
      portalStatusCatalog: [], portalModuleCatalog: [], portalAccessModes: [],
    } });
    if (path === '/announcements/rules/rule/test') {
      testBooking = route.request().postDataJSON().bookingId;
      return route.fulfill({ json: { status: 'sent', recipient: [safety.recipient] } });
    }
    if (path === "/communications/templates")
      return route.fulfill({ json: [template] });
    if (path === "/announcements/library") {
      if (route.request().method() === "POST") {
        saved = route.request().postDataJSON();
        rules = [{ ...saved, _id: "rule", emailTemplateId: template }];
      }
      return route.fulfill({
        json:
          route.request().method() === "GET"
            ? { rules, deliveries: [], settings: { enabled: false } }
            : rules[0],
      });
    }
    if (path === `/announcements/retreats/${retreatId}/settings`) {
      enabled = route.request().postDataJSON().enabled;
      return route.fulfill({ json: { enabled } });
    }
    if (path === `/announcements/retreats/${retreatId}`)
      return route.fulfill({
        json: {
          rules: rules.map((rule) => ({
            ...rule,
            scheduledFor: "2026-10-10T07:00:00Z",
          })),
          settings: { enabled },
          worker: null,
          testRecipients: [{ bookingId: 'booking', name: 'Anna Novak', language: 'cz' }],
          testEmails: [],
          deliveries: [
            {
              _id: "delivery",
              ruleId: "rule",
              bookingId: "booking",
              title: template.name,
              status: "failed",
              scheduledFor: "2026-10-10T07:00:00Z",
              lastError:
                "Missing active CZ translation. Add it before retrying.",
              clientId: {
                firstName: "Anna",
                lastName: "Novak",
                language: "cz",
                email: "anna@example.test",
              },
              history: [
                {
                  at: "2026-10-10T07:01:00Z",
                  status: "failed",
                  message: "Translation unavailable",
                },
              ],
            },
          ],
        },
      });
    if (path === `/retreats/${retreatId}`)
      return route.fulfill({
        json: {
          _id: retreatId,
          name: "October retreat",
          code: "OCT-26",
          startDate: "2026-09-30",
          endDate: "2026-10-07",
          status: "upcoming",
          capacity: 12,
        },
      });
    if (path.endsWith("/hero-image-url"))
      return route.fulfill({ json: { heroImageUrl: null } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/admin/announcements");
  await page.getByRole("button", { name: "+ Add announcement" }).click();
  await page.getByLabel("Number of days").fill("3");
  await page.getByLabel("Before or after").selectOption("after_end");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Email template").selectOption(template._id);
  await expect(
    page.getByLabel("Use each recipient’s preferred language"),
  ).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByText("3 days after the retreat ends at 09:00, send"),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/ppvc614-wizard.png", fullPage: true });
  await page.getByRole("button", { name: "Save announcement" }).click();
  await expect.poll(() => saved?.timing).toBe("after_end");
  await expect(
    page.getByRole("heading", { name: template.name }),
  ).toBeVisible();
  await page.goto(`/admin/retreats/${retreatId}/announcements`);
  await expect(
    page.getByRole("tab", { name: "Announcements" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/Send date: 10 Oct 2026/)).toBeVisible();
  await expect(page.getByText(/Cron not enabled yet/)).toBeVisible();
  await expect(page.getByText(/Email safety ON/)).toBeVisible();
  await page.getByLabel('Sample participant').selectOption('booking');
  await page.getByRole('button', { name: 'Send test to safety inbox' }).click();
  await expect(page.getByText(/Test email sent to info@ibogaspirit.cz/)).toBeVisible();
  expect(testBooking).toBe('booking');
  expect(enabled).toBe(false);
  await page.getByRole("button", { name: "Enable automatic sending" }).click();
  await expect(page.getByText("Automatic sending enabled")).toBeVisible();
  await page
    .getByRole("button", { name: "Edit announcement" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/ppvc614-retreat.png", fullPage: true });
  await page.getByRole("button", { name: "Needs attention (1)" }).click();
  await expect(page.getByText(/Missing active CZ translation/)).toBeVisible();
  await page.getByText("Delivery log · 0 attempts").click();
  await expect(page.getByText(/Translation unavailable/)).toBeVisible();
  await page.goto('/admin/communications');
  await expect(page.getByRole('heading', { name: 'Communications', exact: true })).toBeVisible();
  await page.getByText('Settings', { exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Settings areas' })).toBeVisible();
  await page.getByLabel('Safety inbox').fill('test@example.test');
  await page.getByRole('button', { name: 'Save email safety' }).click();
  await expect(page.getByText('Email safety settings saved.')).toBeVisible();
  await page.screenshot({ path: '/tmp/email-safety-settings.png', fullPage: true });
  await page.getByRole('button', { name: 'Medical notifications', exact: true }).click();
  await expect(page.getByText('MRR client notification test mode', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/retreats/${retreatId}/announcements`);
  await expect(page.getByText(/Email safety ON.*test@example.test/)).toBeVisible();
  await page.getByRole("button", { name: "Needs attention (1)" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBeTruthy();
  await page.screenshot({ path: "/tmp/ppvc614-mobile.png", fullPage: true });
});
