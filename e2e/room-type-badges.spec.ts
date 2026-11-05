import { test, expect, Page } from "@playwright/test";
const retreat = {
  _id: "r1",
  name: "Synthetic room choices",
  code: "ROOM-TEST",
  startDate: "2099-11-17",
  endDate: "2099-11-24",
  status: "scheduled",
  eventType: "full_retreat",
};
const states = [
  ["private", "Private room"],
  ["shared", "Shared room"],
  [null, "Room type unknown"],
  ["private_ensuite", "Private room with private bathroom"],
] as const;
const bookings = states.map(([roomType], i) => ({
  _id: `507f1f77bcf86cd79943901${i}`,
  bookingNumber: 1400 + i,
  status: "confirmed",
  bookingType: "full_retreat",
  roomType,
  roomNumber: "",
  clientId: {
    _id: "c" + i,
    display_id: 330 + i,
    firstName: "Synthetic",
    lastName: "Guest " + i,
    roomType: "private",
    email: "guest" + i + "@example.invalid",
  },
  retreatId: retreat,
  currency: "PLN",
  totalAmount: 3750,
  registrationDate: "2099-01-01",
}));
async function fixture(page: Page) {
  const writes: string[] = [];
  await page.route("**/*", async (route) => {
    const r = route.request();
    if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
    const p = new URL(r.url()).pathname.replace(/^\/api(?=\/)/, "");
    if (r.method() !== "GET") {
      writes.push(r.method() + " " + p);
      return route.fulfill({
        status: 500,
        json: { message: "Read-only accommodation display must not write" },
      });
    }
    if (p === "/environment/status")
      return route.fulfill({
        json: { environment: "local", production: false, enabledJobs: [] },
      });
    if (p === "/retreats/r1") return route.fulfill({ json: retreat });
    if (p === "/retreats") return route.fulfill({ json: [retreat] });
    if (p.startsWith("/bookings/retreat/"))
      return route.fulfill({ json: bookings });
    const booking = bookings.find((b) => p === "/bookings/" + b._id);
    if (booking) return route.fulfill({ json: booking });
    if (p.endsWith("/financial-summary"))
      return route.fulfill({
        json: {
          currency: "PLN",
          price: 3750,
          netPaid: 0,
          balance: 3750,
          sourceState: "verified_ledger",
        },
      });
    if (p.endsWith("/requirement-projection/ekg"))
      return route.fulfill({
        json: {
          version: 1,
          state: "not_applicable",
          applicable: false,
          required: false,
          satisfied: true,
          nextAction: "none",
        },
      });
    if (p.endsWith("/requirements"))
      return route.fulfill({
        json: {
          items: [],
          artifacts: [],
          documents: [],
          reviews: [],
          requirements: [],
        },
      });
    if (p.endsWith("/workflow-snapshot"))
      return route.fulfill({
        json: { items: [], documents: [], actionLogs: [] },
      });
    if (p.includes("/retreat-expenses/"))
      return route.fulfill({
        json: {
          totalExpenses: 0,
          expensesByCategory: [],
          expensesByCurrency: [],
        },
      });
    if (p.includes("/convert"))
      return route.fulfill({
        json: { amount: 100, convertedAmount: 100, rate: 1 },
      });
    return route.fulfill({ json: [] });
  });
  return writes;
}
for (const width of [1440, 390])
  test(`room choices in retreat guest list and booking header at ${width}px`, async ({
    page,
  }) => {
    const writes = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/retreats/r1");
    for (let i = 0; i < states.length; i++) {
      const row = page
        .getByRole("row")
        .filter({
          has: page.getByRole("link", {
            name: "#" + bookings[i].bookingNumber,
            exact: true,
          }),
        });
      await expect(
        row.getByRole("img", { name: states[i][1], exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      animations: "disabled",
      path: `${process.env.ROOM_BADGE_ARTIFACT_DIR || "test-results"}/guests-${width}.png`,
    });
    for (let i = 0; i < states.length; i++) {
      await page.goto("/admin/bookings/" + bookings[i]._id);
      const header = page.locator(".booking-accommodation-title");
      await expect(
        header.getByRole("heading", {
          name: "Booking #" + bookings[i].bookingNumber,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        header.getByRole("img", { name: states[i][1], exact: true }),
      ).toBeVisible();
      expect(
        await header.evaluate(
          (e) => e.getBoundingClientRect().right <= innerWidth,
        ),
      ).toBe(true);
      if (i === 0 || i === 2)
        await page.screenshot({
          animations: "disabled",
          path: `${process.env.ROOM_BADGE_ARTIFACT_DIR || "test-results"}/booking-${i}-${width}.png`,
        });
    }
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
