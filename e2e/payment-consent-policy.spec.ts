import { test, expect } from "@playwright/test";
import fs from "node:fs";
const file = process.env.PAYMENT_CONSENT_FIXTURE,
  f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Use scripts/run-payment-consent-e2e.cjs for required no-skip real API/Mongo cross-app checks.",
);
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`staff consent waiver saves and opens CZ/PL payment without consent at ${width}px`, async ({
    page,
    request,
  }) => {
    await request.post(f.url + "/fixture/consent-reset");
    await page.setViewportSize({ width, height: 1000 });
    const admin = new URL(process.env.PLAYWRIGHT_BASE_URL!).origin,
      cz = process.env.PAYMENT_CONSENT_CZ_URL!,
      pl = process.env.PAYMENT_CONSENT_PL_URL!,
      writes: string[] = [];
    const snapshot = async () =>
      (await request.get(f.url + "/fixture/consent-snapshot")).json();
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "admin@example.invalid" }),
      );
    }, f.tokens.admin);
    await page.route("**/*", async (route) => {
      const q = route.request(),
        u = new URL(q.url());
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      const apiRequest =
        u.pathname.startsWith("/payment-requests") ||
        u.pathname.startsWith("/public/invoices") ||
        u.pathname === "/clients" ||
        u.pathname === "/clients/booking-options" ||
        u.pathname === "/retreats" ||
        u.pathname === "/bookings";
      if (apiRequest) {
        if (q.method() !== "GET") writes.push(q.method() + " " + u.pathname);
        const headers = { ...q.headers() };
        if (
          u.pathname.startsWith("/public/") ||
          u.pathname.startsWith("/payment-requests/public/")
        )
          headers.origin = "https://www.ibogaspirit.cz";
        const response = await route.fetch({
          url: f.url + u.pathname + u.search,
          headers,
        });
        return route.fulfill({
          response,
          headers: {
            ...response.headers(),
            "access-control-allow-origin": q.headers().origin || "*",
          },
        });
      }
      if (q.method() !== "GET") return route.abort();
      const option = {
        key: "shared",
        labels: {
          en: "Shared room",
          cs: "Sdílený pokoj",
          pl: "Pokój współdzielony",
        },
        occupancy: "shared",
        bathroom: "any",
        active: true,
        legacyRoomType: "shared",
        prices: {},
        supported: true,
        availableUnits: null,
        unit: "beds",
      };
      if (u.pathname === "/room-inventory/options")
        return route.fulfill({ json: [option] });
      if (u.pathname.startsWith("/room-inventory/payment-accommodation/"))
        return route.fulfill({
          json: {
            retreatId: f.ids.retreat,
            house: null,
            configured: false,
            houseChanged: false,
            unallocatedConfirmed: 0,
            checkedAt: "2026-10-30T00:00:00Z",
            options: [option],
            rooms: [],
          },
        });
      if (u.pathname.startsWith("/room-inventory/preference/"))
        return route.fulfill({ json: null });

      if (u.pathname === "/payment-request-types")
        return route.fulfill({
          json: ["deposit", "payment", "additional", "balance"].map((key) => ({
            _id: key,
            key,
            label: key,
            active: true,
          })),
        });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (
        u.pathname.includes("settings") ||
        u.pathname.includes("config-summary")
      )
        return route.fulfill({ json: {} });
      if (u.pathname.includes("convert-to-usd"))
        return route.fulfill({ json: { usd_amount: 250 } });
      return route.fulfill({ json: [] });
    });
    for (const url of [cz, pl]) {
      await page.goto(
        url +
          "/clients/payment/request/" +
          f.ids.hashes[0] +
          "?lang=en&consentRequired=false&preview=true",
      );
      await expect(page.locator("#consent1")).toBeVisible();
      await expect(page.locator("#consent1")).not.toBeChecked();
      await expect(
        page.getByRole("heading", { name: "Revolut", exact: true }),
      ).toHaveCount(0);
    }
    await page.goto(
      admin + "/admin/payment-requests/" + f.ids.requests[0] + "/edit",
    );
    const checkbox = page.getByLabel("Require consent before payment", {
      exact: true,
    });
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await page
      .getByRole("button", { name: "Update Request", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await snapshot()).requests.find(
            (r: any) => r._id === f.ids.requests[0],
          ).consentRequired,
      )
      .toBe(false);
    await page.goto(
      admin + "/admin/payment-requests/" + f.ids.requests[0] + "/edit",
    );
    await expect(checkbox).not.toBeChecked();
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.locator("..").screenshot({
      path: `${process.env.PAYMENT_CONSENT_ARTIFACT_DIR || "test-results"}/setting-${width}.png`,
    });
    for (const [site, url] of [
      ["cz", cz],
      ["pl", pl],
    ])
      for (const index of [0, 2]) {
        await page.goto(
          url + "/clients/payment/request/" + f.ids.hashes[index] + "?lang=en",
        );
        await expect(
          page.getByRole("heading", { name: "Revolut", exact: true }),
        ).toBeVisible();
        await expect(page.locator("#consent1")).toHaveCount(0);
        await page.screenshot({
          path: `${process.env.PAYMENT_CONSENT_ARTIFACT_DIR || "test-results"}/${site}-${index}-${width}.png`,
          fullPage: true,
        });
      }
    let state = await snapshot();
    expect(
      state.requests.every((r: any) => !r.depositConsent && !r.identityChange),
    ).toBe(true);
    expect(state.payments).toEqual([]);
    expect(state.effects).toEqual({ uploads: [], emails: [] });
    // Re-enable on the real API, then preview with the actual trusted PL renderer.
    await request.put(f.url + "/payment-requests/" + f.ids.requests[0], {
      headers: { Authorization: "Bearer " + f.tokens.admin },
      data: { consentRequired: true },
    });
    const before = await snapshot();
    await page.goto(admin + "/admin/payment-requests/" + f.ids.requests[0]);
    await page
      .getByRole("button", {
        name: "Preview online invoice (admin)",
        exact: true,
      })
      .click();
    const frame = page.frameLocator(
      'iframe[title="Actual client invoice page"]',
    );
    await expect(
      frame.getByRole("heading", { name: "Revolut", exact: true }),
    ).toBeVisible();
    await expect(frame.locator("#consent1")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
    expect(await snapshot()).toEqual(before);
    expect(writes).toEqual(["PUT /payment-requests/" + f.ids.requests[0]]);
  });
