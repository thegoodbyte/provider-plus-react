import { test, expect } from "@playwright/test";
import path from "node:path";
const note =
  "Synthetic advisor instruction, including detailed follow-up and precautions. ".repeat(
    25,
  ) + "END OF FULL NOTE";
for (const width of [1440, 390])
  test(`medical grid print snapshot at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [],
      writes: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const retreat = {
      _id: "r999",
      name: "Synthetic Print Retreat",
      retreatCode: "PRINT-999",
      type: "regular",
      status: "scheduled",
      startDate: "2099-01-01",
      endDate: "2099-01-07",
      capacity: 10,
    };
    const bookings = Array.from({ length: 7 }, (_, i) => ({
      _id: `b${i}`,
      bookingNumber: 1300 + i,
      clientId: {
        _id: `c${i}`,
        firstName: "Synthetic",
        lastName: `Guest ${i}`,
        display_id: 1200 + i,
      },
      retreatId: retreat,
      status: "confirmed",
    }));
    await page.addInitScript(() => {
      (window as any).__prints = 0;
      window.print = () => {
        (window as any).__prints++;
      };
    });
    await page.route("**/*", async (route) => {
      const r = route.request();
      if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
      const p = new URL(r.url()).pathname.replace(/^\/api(?=\/)/, "");
      if (r.method() !== "GET") {
        writes.push(p);
        return route.abort();
      }
      if (p === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (p.startsWith("/bookings/retreat/"))
        return route.fulfill({ json: bookings });
      if (p.startsWith("/medical-review-requests"))
        return route.fulfill({
          json: [
            {
              _id: "m999",
              display_id: 1999,
              clientId: "c0",
              bookingId: "b0",
              requestType: "ekg_review",
              status: "approved",
              reviewNotes: note,
            },
          ],
        });
      if (p === "/retreats/r999") return route.fulfill({ json: retreat });
      if (p === "/retreats") return route.fulfill({ json: [retreat] });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/retreats/r999/tracking");
    const opener = page.getByRole("button", { name: "Print medical grid" });
    await opener.click();
    const preview = page.getByRole("dialog", {
      name: "Medical grid print preview",
    });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("table")).toHaveCount(3);
    await expect(preview.getByText(note, { exact: true })).toHaveCount(1);
    await expect(
      preview.getByText("Booking #1306", { exact: true }),
    ).toHaveCount(1);
    await preview.getByRole("button", { name: "Print / Save PDF" }).click();
    expect(await page.evaluate(() => (window as any).__prints)).toBe(1);
    await page.screenshot({
      path: testInfo.outputPath(`preview-${width}.png`),
    });
    // A previously visited client-print route leaves a global visibility rule.
    // The medical print view must remain isolated and visible in that session.
    await page.addStyleTag({
      content: "@media print { body * { visibility: hidden !important; } }",
    });
    await page.emulateMedia({ media: "print" });
    await expect(
      preview
        .getByRole("heading", { name: "Medical Grid · PRINT-999" })
        .first(),
    ).toBeVisible();
    await expect(page.locator(".retreat-medical-print-toolbar")).toBeHidden();
    expect(
      await page
        .locator(".retreat-medical-print-sheet")
        .evaluateAll((elements) =>
          elements.every((e) => e.scrollWidth <= e.clientWidth + 1),
        ),
    ).toBe(true);
    await page.pdf({
      path: process.env.MEDICAL_PRINT_OUTPUT
        ? path.join(
            process.env.MEDICAL_PRINT_OUTPUT,
            `medical-grid-${width}.pdf`,
          )
        : testInfo.outputPath(`medical-grid-${width}.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: "screen" });
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
