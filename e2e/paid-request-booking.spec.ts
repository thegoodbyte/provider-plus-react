import { test, expect } from "@playwright/test";
import fs from "node:fs";
const file = process.env.PAID_BOOKING_FIXTURE;
const f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Use scripts/run-paid-request-booking-e2e.cjs for the required no-skip real Mongo/API journey.",
);
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`scratchpad confirmation continues to one booking with existing money at ${width}px`, async ({
    page,
    request,
  }) => {
    const reset = await request.post(f.url + "/fixture/paid-reset");
    expect(reset.ok()).toBe(true);
    const { ids } = await reset.json();
    const snapshot = async () =>
      (await request.get(f.url + "/fixture/edit-snapshot")).json();
    const before = await snapshot();
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "synthetic@example.invalid" }),
      );
    }, f.tokens.admin);
    const writes: string[] = [];
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (!["xhr", "fetch"].includes(req.resourceType()))
        return route.continue();
      if (req.method() !== "GET")
        writes.push(req.method() + " " + url.pathname);
      if (
        url.pathname.startsWith("/payment-scratchpad") ||
        url.pathname.startsWith("/payment-requests") ||
        url.pathname === "/bookings" ||
        /^\/bookings\/[a-f\d]{24}$/.test(url.pathname) ||
        url.pathname === "/bookings/next-booking-number" ||
        url.pathname === "/bookings/booking-number-available" ||
        url.pathname === "/clients" ||
        url.pathname === "/clients/booking-options" ||
        /^\/clients\/[a-f\d]{24}$/.test(url.pathname) ||
        url.pathname === "/retreats" ||
        /^\/retreats\/[a-f\d]{24}$/.test(url.pathname)
      ) {
        const response = await route.fetch({
          url: f.url + url.pathname + url.search,
        });
        return route.fulfill({ response });
      }
      if (req.method() !== "GET") return route.abort();
      if (url.pathname === "/room-inventory/options")
        return route.fulfill({
          json: [
            {
              key: "shared",
              legacyRoomType: "shared",
              labels: { en: "Shared room" },
              occupancy: "shared",
              active: true,
            },
            {
              key: "private",
              legacyRoomType: "private",
              labels: { en: "Private room" },
              occupancy: "private",
              active: true,
            },
          ],
        });
      if (url.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (
        url.pathname.includes("config-summary") ||
        url.pathname.includes("settings")
      )
        return route.fulfill({ json: {} });
      return route.fulfill({ json: [] });
    });
    await page.goto(
      "/admin/payments/scratchpad/" + ids.receipts[0] + "?match=1",
    );
    await expect(
      page.getByRole("button", { name: "Confirm payment from scratchpad" }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Confirm payment from scratchpad" })
      .click();
    const next = page.getByRole("region", { name: "Next booking step" });
    await expect(next).toBeVisible();
    await expect(
      next.getByRole("link", { name: "Create booking", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp("/scratchpad/" + ids.receipts[0]));
    let saved = await snapshot();
    expect(saved.bookings).toHaveLength(0);
    expect(saved.payments).toHaveLength(before.payments.length + 1);
    expect(saved.requests).toHaveLength(before.requests.length);
    await page.reload();
    await expect(
      next.getByRole("link", { name: "Create booking", exact: true }),
    ).toBeVisible();
    await next.screenshot({
      path: `${process.env.PAID_BOOKING_ARTIFACT_DIR || "test-results"}/next-${width}.png`,
    });
    await next
      .getByRole("link", { name: "Create booking", exact: true })
      .click();
    await expect(page).toHaveURL(/\/bookings\/new\?/);
    expect(new URL(page.url()).searchParams.get("paymentPlanEnabled")).toBe(
      "false",
    );
    expect(new URL(page.url()).searchParams.get("totalAmount")).toBe("2500");
    expect(new URL(page.url()).searchParams.has("amountPaid")).toBe(false);
    await expect(
      page.getByRole("button", { name: "Add Booking", exact: true }),
    ).toBeVisible();
    const room = page.getByRole("combobox", { name: /^Accommodation/ });
    await expect(room).toHaveValue("shared");
    if (width === 390) await room.selectOption("private");
    await page
      .getByRole("button", { name: "Add Booking", exact: true })
      .click();
    await expect.poll(async () => (await snapshot()).bookings.length).toBe(1);
    saved = await snapshot();
    const booking = saved.bookings[0];
    expect(booking.roomType).toBe(width === 390 ? "private" : "shared");
    expect(booking.totalAmount).toBe(2500);
    expect(booking.amountPaid).toBe(1000);
    expect(booking.paymentPlanEnabled).toBe(false);
    expect(saved.requests).toHaveLength(before.requests.length);
    expect(saved.payments).toHaveLength(before.payments.length + 1);
    expect(
      saved.requests.find((r: any) => r._id === ids.requests[0]).bookingId,
    ).toBe(booking._id);
    expect(
      saved.payments
        .filter((p: any) => p.paymentRequestId === ids.requests[0])
        .every((p: any) => p.bookingId === booking._id),
    ).toBe(true);
    expect(saved.emails).toEqual([]);
    await expect(page).toHaveURL(new RegExp("/bookings/" + booking._id + "$"));
    await page.goto("/admin/payments/scratchpad/" + ids.receipts[0]);
    await expect(
      next.getByRole("link", { name: "Open booking", exact: true }),
    ).toHaveAttribute("href", "/admin/bookings/" + booking._id);
    await expect(
      next.getByRole("link", { name: "Create booking", exact: true }),
    ).toHaveCount(0);
    await next.screenshot({
      path: `${process.env.PAID_BOOKING_ARTIFACT_DIR || "test-results"}/linked-${width}.png`,
    });
    expect(writes.filter((v) => v === "POST /bookings")).toHaveLength(1);
    expect(writes.filter((v) => /^POST \/payments/.test(v))).toHaveLength(0);
  });
