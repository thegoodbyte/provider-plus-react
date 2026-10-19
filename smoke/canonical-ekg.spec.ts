import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const path = process.env.EKG_FIXTURE;
const f = path ? JSON.parse(readFileSync(path, "utf8")) : {};
const re = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4490",
  ir = process.env.EKG_IR_URL || "http://127.0.0.1:4491";
test.skip(
  !path,
  "Requires isolated PPVC-890 Nest/JWT/Mongo fixture. Never production.",
);
test.setTimeout(120000);
test.use({ actionTimeout: 10000 });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ tokens, clientId }) => {
    localStorage.setItem("token", tokens.admin);
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "fixture-admin",
        role: "admin",
        email: "staff@example.invalid",
      }),
    );
    localStorage.setItem("client_auth_token", tokens.client);
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: {
          user: {
            id: clientId,
            name: "EKG Fixture",
            email: "ekg@example.invalid",
            language: "en",
          },
          token: tokens.client,
          isAuthenticated: true,
        },
        version: 0,
      }),
    );
    sessionStorage.setItem("profile-photo-prompt-dismissed", "true");
  }, f);
  page.on("pageerror", (error) => console.log("Browser error:", error.stack));
  await page.route("**/*", async (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if ([re, ir].includes(u.origin) && !u.pathname.startsWith("/api/"))
      return route.continue();
    const p = u.pathname.replace(/^\/api(?=\/)/, "");
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": req.headers().origin || re,
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": "authorization,content-type",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    if (p.endsWith("/hero-image-url")) return route.fulfill({json:{url:null}});
    const live =
      p.includes("/requirement-projection/ekg") ||
      p.startsWith("/client-portal/requirements/") ||
      p === "/client-portal/account" ||
      p.endsWith("/workflow-summary") ||
      p.endsWith("/requirements") ||
      p.startsWith("/bookings/") ||
      p.startsWith("/clients/") ||
      p.startsWith("/retreats");
    if (live) {
      const response = await route.fetch({ url: f.url + p + u.search });
      
      return route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "access-control-allow-origin":
            req.headers().origin || (page.url().startsWith(ir) ? ir : re),
          "access-control-allow-credentials": "true",
        },
      });
    }
    return route.fulfill({
      json:
        p === "/client-portal/aftercare" ? {retreats:[],calls:[]} : p === "/client-portal/integration/coach" ? {journals:[]} : p === "/config-summary" || p === "/users/navigation-permissions"
          ? {}
          : p === "/environment/status"
            ? { production: false }
            : p.endsWith("unread-count")
              ? { count: 0 }
              : [],
    });
  });
});
for (const width of [1440, 390])
  test(`same EKG decision across booking, retreat summary and IR at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const stage of [
      "missing",
      "uploaded",
      "awaiting_review",
      "correction_needed",
      "replacement",
      "awaiting_review",
      "accepted",
    ]) {
      const update = await request.post(f.url + "/__fixture/transition", {
        headers: { "x-fixture-key": "PPVC890" },
        data: { stage },
      });
      expect(update.ok(), await update.text()).toBe(true);
      const expected = stage === "replacement" ? "uploaded" : stage;
      await page.goto(`${re}/admin/bookings/${f.bookingId}`);
      await page.getByRole("tab", { name: /^Requirements/ }).click();
      await expect(page.locator("#booking-requirement-ekg")).toHaveAttribute(
        "data-ekg-state",
        expected,
      );
      await page.goto(`${re}/admin/workflow/bookings/${f.bookingId}`);
      await page.getByRole("button", { name: "medical", exact: true }).click();
      await expect(
        page
          .locator(".workflow-medical-requirement")
          .filter({
            has: page.getByRole("heading", { name: "EKG", exact: true }),
          }),
      ).toHaveAttribute("data-ekg-state", expected);
      await page.goto(ir + "/workflow");
      await expect(page.locator("[data-ekg-state]").first()).toHaveAttribute(
        "data-ekg-state",
        expected,
      );
      if (stage === "replacement")
        expect(
          await page.locator("[data-ekg-state]").first().innerText(),
        ).not.toMatch(/Approved|Accepted/);
    }
    await page.reload();
    await expect(page.locator("[data-ekg-state]").first()).toHaveAttribute(
      "data-ekg-state",
      "accepted",
    );
    await page.screenshot({
      path: `../ppvc-890-validation/ir-${width}.png`,
      fullPage: true,
    });
    // Client medical tab is a separate entry point using the same scoped read.
    await page.goto(`${re}/admin/clients/${f.clientId}`);
    await page.getByRole("button", { name: "Medical Info", exact:true }).click();
    await expect(
      page
        .getByRole("region", { name: "Entry EKG status" })
        .getByRole("status"),
    ).toHaveAttribute("data-ekg-state", "accepted");
    await page.screenshot({
      path: `../ppvc-890-validation/staff-${width}.png`,
      fullPage: true,
    });
  });
test("unavailable never becomes missing or complete and explicit waiver/not-applicable remain distinct", async ({
  page,
  request,
}) => {
  for (const stage of ["missing", "waived", "not_applicable", "unavailable"]) {
    await request.post(f.url + "/__fixture/transition", {
      headers: { "x-fixture-key": "PPVC890" },
      data: { stage },
    });
    await page.goto(ir + "/workflow");
    await expect(page.locator("[data-ekg-state]").first()).toHaveAttribute(
      "data-ekg-state",
      stage,
    );
  }
});
