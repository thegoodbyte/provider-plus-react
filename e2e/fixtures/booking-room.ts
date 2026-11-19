import { Page } from "@playwright/test";
// Read-only accommodation configuration. Actual booking writes go to the real API.
export async function bookingRoomOptions(page: Page) {
  await page.route("**/room-inventory/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    const options = ["shared", "private"].map((key) => ({
      key,
      legacyRoomType: key,
      labels: { en: key === "shared" ? "Shared room" : "Private room" },
      occupancy: key,
      active: true,
      supported: true,
      availableUnits: null,
      unit: "beds",
      prices: {},
    }));
    if (p === "/room-inventory/options")
      return route.fulfill({ json: options });
    if (p.includes("/payment-accommodation/"))
      return route.fulfill({
        json: {
          options,
          rooms: [],
          house: null,
          configured: false,
          houseChanged: false,
          unallocatedConfirmed: 0,
          checkedAt: "2026-11-19T00:00:00Z",
        },
      });
    return route.fulfill({ json: null });
  });
}
export async function chooseBookingRoom(page: Page) {
  await page
    .getByRole("combobox", { name: /^Accommodation/ })
    .selectOption("shared");
}
export async function dismissFeedback(page: Page) {
  const dismiss = page.getByRole("button", { name: "Dismiss loading message" });
  if (await dismiss.isVisible()) await dismiss.click();
}
