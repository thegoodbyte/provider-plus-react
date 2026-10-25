import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixturePath = process.env.MRR_BOOKING_LINK_FIXTURE;
const f = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, "utf8")) : {};
test.skip(
  !fixturePath,
  "Requires the disposable real Mongo/Nest MRR booking-link fixture",
);
for (const width of [1440, 390])
  for (const conflict of [false, true])
    test(`MRR booking link ${conflict ? "stale confirmation" : "save and reload"} at ${width}px`, async ({
      page,
      request,
    }) => {
      const index = (width === 1440 ? 0 : 2) + Number(conflict),
        row = f.cases[index];
      await page.setViewportSize({ width, height: 980 });
      await page.addInitScript((token) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: "staff",
            role: "admin",
            email: "admin@example.invalid",
          }),
        );
      }, f.tokens.admin);
      let posts = 0;
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          path = url.pathname;
        if (!["xhr", "fetch"].includes(req.resourceType()))
          return route.continue();
        if (path.endsWith("/access-links")) return route.fulfill({ json: [] });
        if (path.startsWith("/medical-review-requests")) {
          if (path.endsWith("/booking-link") && req.method() === "POST")
            posts++;
          return route.fulfill({
            response: await route.fetch({ url: f.url + path + url.search }),
          });
        }
        if (path === "/environment/status")
          return route.fulfill({
            json: { environment: "local", production: false, enabledJobs: [] },
          });
        return route.fulfill({ json: [] });
      });
      await page.goto("/admin/medical-review-requests/" + row.requestId);
      const panel = page.getByRole("region", { name: "MRR booking link" });
      await expect(panel).toContainText("Not linked to a booking");
      await panel
        .getByRole("button", { name: "Link to booking", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const confirm = dialog.getByRole("button", {
        name: "Confirm booking link",
        exact: true,
      });
      await expect(confirm).toBeDisabled();
      await dialog.getByLabel("Client booking").selectOption(f.bookingId);
      await expect(confirm).toBeEnabled();
      await expect(dialog.getByText("Synthetic EKG")).toBeVisible();
      await expect(dialog.getByText("Synthetic Liver")).toBeVisible();
      expect(
        await dialog
          .getByLabel("Client booking")
          .locator("option")
          .allTextContents(),
      ).not.toContainEqual(expect.stringContaining("#1999"));
      expect(posts).toBe(0);
      await dialog.screenshot({
        path: `../ppvc-929-validation/booking-link-${width}-${conflict ? "stale" : "success"}.png`,
      });
      if (conflict) {
        const headers = { Authorization: "Bearer " + f.tokens.admin },
          endpoint =
            f.url +
            "/medical-review-requests/" +
            row.requestId +
            "/booking-link";
        const preview = await request.get(
          endpoint + "?bookingId=" + f.otherBookingId,
          { headers },
        );
        expect(preview.ok()).toBeTruthy();
        expect(
          (
            await request.post(endpoint, {
              headers,
              data: {
                bookingId: f.otherBookingId,
                previewToken: (await preview.json()).token,
              },
            })
          ).ok(),
        ).toBeTruthy();
        await confirm.click();
        await expect(dialog.getByRole("alert")).toContainText(
          "No reassignment was made",
        );
        await expect(confirm).toBeDisabled();
        await dialog
          .getByRole("button", { name: "Close", exact: true })
          .last()
          .click();
      } else {
        await confirm.click();
        await expect(
          dialog.getByText("Booking link saved.", { exact: false }),
        ).toBeVisible();
        await dialog
          .getByRole("button", { name: "Close", exact: true })
          .last()
          .click();
      }
      expect(posts).toBe(1);
      await page.reload();
      await expect(
        panel.getByRole("link", {
          name: conflict ? "Booking #1933" : "Booking #1929",
          exact: true,
        }),
      ).toBeVisible();
      const saved = await request.get(
        f.url + "/medical-review-requests/" + row.requestId,
        { headers: { Authorization: "Bearer " + f.tokens.admin } },
      );
      const result = await saved.json();
      expect(result.reviewNotes).toBe("Preserve advisor decision and notes");
      expect(result.reviewDecision).toBe("OK");
      expect(
        result.artifactIds.every(
          (a: any) =>
            String(a.bookingId) === (conflict ? f.otherBookingId : f.bookingId),
        ),
      ).toBeTruthy();
    });
