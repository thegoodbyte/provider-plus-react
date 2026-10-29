import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixturePath = process.env.RESCHEDULE_STAY_FIXTURE;
test.skip(
  !fixturePath,
  "Requires real local API/Mongo fixture; run documented standalone command",
);
for (const [width, timezoneId] of [
  [1440, "America/Los_Angeles"],
  [390, "Pacific/Kiritimati"],
] as const)
  test.describe(`${width}px ${timezoneId}`, () => {
    test.use({ timezoneId });
    test("reschedule persists destination dates and times, reloads and appears in planner", async ({
      page,
      request,
    }) => {
      const f = JSON.parse(fs.readFileSync(fixturePath!, "utf8"));
      expect((await request.post(f.url + "/fixture/reset")).ok()).toBe(true);
      const before = await (
          await request.get(f.url + "/fixture/snapshot")
        ).json(),
        headers = { Authorization: "Bearer " + f.tokens.admin };
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
      await page.addInitScript((token) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ role: "admin", email: "synthetic@example.invalid" }),
        );
      }, f.tokens.admin);
      await page.route("**/*", async (route) => {
        const q = route.request();
        if (!["xhr", "fetch"].includes(q.resourceType()))
          return route.continue();
        const u = new URL(q.url());
        if (
          u.pathname.startsWith("/bookings") ||
          u.pathname === "/retreats" ||
          u.pathname.startsWith("/retreats/")
        )
          return route.fulfill({
            response: await route.fetch({
              url: f.url + u.pathname + u.search,
              headers: { ...q.headers(), ...headers },
            }),
          });
        if (u.pathname === "/environment/status")
          return route.fulfill({
            json: { environment: "local", production: false, enabledJobs: [] },
          });
        if (u.pathname.includes("retreat-expenses"))
          return route.fulfill({ json: { totalExpenses: 0, categories: [] } });
        if (
          u.pathname.includes("config-summary") ||
          u.pathname === "/users/navigation-permissions"
        )
          return route.fulfill({ json: {} });
        return route.fulfill({ json: [] });
      });
      const loaded = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/bookings/" + f.ids.bookings[0],
      );
      await page.goto("/admin/bookings/" + f.ids.bookings[0]);
      expect((await loaded).status()).toBe(200);
      await page.getByLabel("More booking actions").click();
      await page
        .getByRole("button", { name: "Reschedule booking", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Reschedule booking" });
      await dialog
        .getByRole("combobox", { name: "Move to retreat" })
        .selectOption(f.ids.target);
      await expect(dialog).toContainText(
        "Arrival: 17:30 · Departure: 10:15 (Europe/Prague)",
      );
      await dialog
        .getByRole("textbox", { name: "Internal note" })
        .fill("New stay requested");
      await dialog.screenshot({
        path: `${process.env.RESCHEDULE_STAY_ARTIFACT_DIR || "test-results"}/dialog-${width}.png`,
      });
      await dialog.getByRole("button", { name: "Confirm reschedule" }).click();
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await page.getByText("Booking dates", { exact: true }).click();
      await expect(
        page.getByText("Mar 28, 2099 · 17:30", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Apr 4, 2099 · 10:15", { exact: true }),
      ).toBeVisible();
      const after = await (
          await request.get(f.url + "/fixture/snapshot")
        ).json(),
        row = after.bookings.find((b: any) => b._id === f.ids.bookings[0]);
      expect(row.retreatId).toBe(f.ids.target);
      expect(row.checkInDate).toBe("2099-03-28T16:30:00.000Z");
      expect(row.checkOutDate).toBe("2099-04-04T08:15:00.000Z");
      expect(row.rescheduleHistory).toHaveLength(1);
      expect(after.bookings.filter((b: any) => b._id !== row._id)).toEqual(
        before.bookings.filter((b: any) => b._id !== row._id),
      );
      expect(after.payments).toEqual(before.payments);
      expect(after.requests).toEqual(before.requests);
      expect(after.emails).toEqual([]);
      expect((await request.post(f.url + "/fixture/legacy-stay")).ok()).toBe(
        true,
      );
      await page.reload();
      await page
        .getByRole("button", { name: "Align stay dates to current retreat" })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "Stay dates aligned" }),
      ).toBeVisible();
      await page
        .getByRole("region", { name: "Moved booking dates" })
        .screenshot({
          path: `${process.env.RESCHEDULE_STAY_ARTIFACT_DIR || "test-results"}/repair-${width}.png`,
        });
      await page.getByText("Booking dates", { exact: true }).click();
      await expect(
        page.getByText("Mar 28, 2099 · 17:30", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${process.env.RESCHEDULE_STAY_ARTIFACT_DIR || "test-results"}/dates-${width}.png`,
        fullPage: true,
      });
      await page.goto("/admin/retreats/" + f.ids.target + "/stayPlanner");
      const planner = page.getByRole("region", {
        name: "Retreat stay planner",
        exact: true,
      });
      await expect(
        planner.getByRole("link", { name: /Full retreat #9600/ }),
      ).toBeVisible();
      await expect(
        planner.getByText("1 occupied · 9 free", { exact: true }),
      ).toHaveCount(7);
      await page.reload();
      await expect(
        planner.getByRole("link", { name: /Full retreat #9600/ }),
      ).toBeVisible();
      const boosterMove = await request.patch(
        f.url + "/bookings/" + f.ids.bookings[2] + "/reschedule",
        {
          headers,
          data: {
            targetRetreatId: f.ids.target,
            reason: "client_requested",
            note: "Booster destination requested",
          },
        },
      );
      expect(boosterMove.status()).toBe(200);
      await page.reload();
      await expect(
        planner.getByRole("link", { name: /Booster #9602/ }),
      ).toBeVisible();
      await expect(
        planner.getByText("2 occupied · 8 free", { exact: true }),
      ).toHaveCount(1);
      await expect(
        planner.getByText("1 occupied · 9 free", { exact: true }),
      ).toHaveCount(6);
      await page.screenshot({
        path: `${process.env.RESCHEDULE_STAY_ARTIFACT_DIR || "test-results"}/planner-${width}.png`,
        fullPage: true,
      });
    });
  });
