import { test, expect } from "./fixtures/client-workspace";

for (const width of [1440, 390])
  test.describe(`Client tags ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
    });
    test("adds, normalizes, retries and removes client tags without changing a sibling", async ({
      page,
      clientWorkspace: f,
    }, testInfo) => {
      await f.models.Client.updateOne(
        { _id: f.ids.client },
        { $set: { tags: ["medically-approved"] } },
      );
      await f.models.Client.updateOne(
        { _id: f.ids.sibling },
        { $set: { tags: ["sibling-only"] } },
      );
      const sibling = JSON.parse(
        JSON.stringify(await f.models.Client.findById(f.ids.sibling).lean()),
      );
      await page.goto(`/admin/clients/${f.ids.client}`);
      await expect(
        page.getByRole("heading", { name: "Client Tags", exact: true }),
      ).toBeVisible();
      await page.getByLabel("New client tag").fill("Ekg received");
      let fail = true;
      await page.route(`**/clients/${f.ids.client}`, async (route) => {
        if (route.request().method() === "PATCH" && fail) {
          fail = false;
          return route.fulfill({
            status: 503,
            json: { message: "Synthetic tag outage" },
          });
        }
        return route.fallback();
      });
      await page.getByRole("button", { name: "Add tag", exact: true }).click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: /Synthetic tag outage|temporarily unavailable/ }),
      ).toBeVisible();
      await expect(page.getByLabel("New client tag")).toHaveValue(
        "Ekg received",
      );
      await page.getByRole("button", { name: "Add tag", exact: true }).click();
      await expect(page.getByLabel("Remove tag ekg-received")).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Remove tag ekg-received")).toBeVisible();
      await page
        .getByRole("heading", { name: "Client Tags", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("client-tags.png") });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByLabel("New client tag").fill("ekg_received");
      await expect(
        page.getByRole("button", { name: "Add tag", exact: true }),
      ).toBeDisabled();
      expect(
        (await f.models.Client.findById(f.ids.client).lean()).tags,
      ).toEqual(["medically-approved", "ekg-received"]);
      await page.getByLabel("Remove tag ekg-received").click();
      await expect(page.getByLabel("Remove tag ekg-received")).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByLabel("Remove tag medically-approved"),
      ).toBeVisible();
      expect(
        (await f.models.Client.findById(f.ids.client).lean()).tags,
      ).toEqual(["medically-approved"]);
      expect(
        JSON.parse(
          JSON.stringify(await f.models.Client.findById(f.ids.sibling).lean()),
        ),
      ).toEqual(sibling);
    });

    test("filters the client grid by tag and restores both sibling records", async ({
      page,
      clientWorkspace: f,
    }) => {
      await f.models.Client.updateOne(
        { _id: f.ids.client },
        { $set: { tags: ["medically-approved"] } },
      );
      await f.models.Client.updateOne(
        { _id: f.ids.sibling },
        { $set: { tags: ["sibling-only"] } },
      );
      await page.goto("/admin/clients");
      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(2);
      await page
        .getByLabel("Filter clients by tag", { exact: true })
        .selectOption("medically-approved");
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText("Ewa");
      await page
        .getByLabel("Filter clients by tag", { exact: true })
        .selectOption("");
      await expect(rows).toHaveCount(2);
    });
  });
