import { expect, test } from "./fixtures/referral-workspace";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

test.describe.configure({ mode: "serial" });

for (const width of [1440, 390])
  test(`dated commission saving and real calculation at ${width}px`, async ({
    page,
    request,
    baseURL,
    referralWorkspace: f,
  }) => {
    test.setTimeout(90000);
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const root = path.resolve(__dirname, "../../..");
    const mongoose = require(
      path.join(
        process.env.TEST_API_CHECKOUT || path.resolve(__dirname, "../../api"),
        "node_modules/mongoose",
      ),
    );
    const api = f.url,
      session = {
        access_token: f.tokens.admin,
        user: { role: "admin", email: "admin@example.invalid" },
      },
      headers = { Authorization: "Bearer " + f.tokens.admin },
      connection = f.db,
      db = f.db.db;
    const marker = "PPVC806-" + randomUUID().slice(0, 8);
    const partner = new mongoose.Types.ObjectId();
    const retreat = new mongoose.Types.ObjectId();
    const expense = new mongoose.Types.ObjectId();
    const clients = Array.from(
      { length: 6 },
      () => new mongoose.Types.ObjectId(),
    );
    const bookings = clients.map(() => new mongoose.Types.ObjectId());
    try {
      await db
        .collection("referrals")
        .insertOne({
          _id: partner,
          name: marker,
          referralCode: "ZQ",
          defaultCommissionPercentage: 10,
          influenceCommissionPercentage: 0,
          isActive: true,
        });
      await db
        .collection("retreats")
        .insertOne({ _id: retreat, name: marker, code: marker });
      await db
        .collection("clients")
        .insertMany(
          clients.map((_id, i) => ({
            _id,
            firstName: marker,
            lastName: String(i),
            email: `${marker}-${i}@example.invalid`,
            referralCommissionPercentage: 0,
            display_id: 990806 + i,
          })),
        );
      const dates = [
        "2026-07-13T18:51:02Z",
        "2026-07-13T18:58:04Z",
        "2026-07-14T10:00:00Z",
        "2026-06-14T21:59:59Z",
        "2026-06-14T22:00:00Z",
        "2027-01-01T00:00:00Z",
      ];
      const prices = [8500, 9500, 2523, 1000, 1000, 1000];
      await db
        .collection("retreatclients")
        .insertMany(
          bookings.map((_id, i) => ({
            _id,
            clientId: clients[i],
            retreatId: retreat,
            bookingNumber: 990806 + i,
            bookingHash: marker + i,
            registrationDate: new Date(dates[i]),
            totalAmount: prices[i],
            currency: i === 2 ? "EUR" : "PLN",
            status: "active",
            referralAttribution: "self_identified",
            referralPartnerId: partner,
          })),
        );
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        ({ token, user }) => {
          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(user));
        },
        { token: session.access_token, user: session.user },
      );
      await page.goto(`/admin/referrals/${partner}/edit`);
      await page
        .getByRole("button", { name: "Add commission package", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(
        page
          .getByRole("form", { name: "Referral settings" })
          .getByRole("alert"),
      ).toContainText("Complete the required fields");
      await page.getByLabel("Package From", { exact: true }).fill("2026-01-01");
      await page
        .getByLabel("Package To (blank = ongoing)", { exact: true })
        .fill("2026-12-31");
      await page.getByLabel("Starting percentage", { exact: true }).fill("19");
      await page
        .getByRole("button", { name: "Add percentage change", exact: true })
        .click();
      await page.getByLabel("Rate From", { exact: true }).fill("2026-06-15");
      await page.getByLabel("New percentage", { exact: true }).fill("20");
      await expect(
        page.getByText("2026-01-01 to 2026-06-14 · 19%", { exact: true }),
      ).toBeVisible();
      let failOnce = true;
      await page.route(`**/referrals/${partner}`, (route) => {
        if (route.request().method() === "PATCH" && failOnce) {
          failOnce = false;
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "Temporary test failure" }),
          });
        }
        return route.fallback();
      });
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(
        page
          .getByRole("form", { name: "Referral settings" })
          .getByRole("alert"),
      ).toBeVisible();
      await expect(
        page.getByLabel("New percentage", { exact: true }),
      ).toHaveValue("20");
      await page
        .getByLabel("Starting percentage", { exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.resolve(
          `test-results/referral-date-packages/rates-${width}.png`,
        ),
      });
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(
        page.getByText("Referral saved.", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByLabel("New percentage", { exact: true }),
      ).toHaveValue("20");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.resolve(
          `test-results/referral-date-packages/packages-${width}.png`,
        ),
        fullPage: true,
      });
      const report = async () => {
        const response = await request.get(
          api + `/referrals/report?referralId=${partner}`,
          { headers },
        );
        expect(response.ok()).toBeTruthy();
        const all = await response.json();
        return all.filter((row: any) =>
          bookings.some((id) => String(id) === row.bookingId),
        );
      };
      let rows = await report();
      expect(rows).toHaveLength(6);
      const row = (index: number) =>
        rows.find((item: any) => item.bookingId === String(bookings[index]));
      expect([row(0).amountOwed, row(1).amountOwed, row(2).amountOwed]).toEqual(
        [1700, 1900, 504.6],
      );
      expect(row(2).owedCurrency).toBe("EUR");
      expect(row(3).commissionPercentage).toBe(19);
      expect(row(4).commissionPercentage).toBe(20);
      expect(row(5).commissionIssue).toBeTruthy();
      expect(
        (
          await request.patch(api + `/referrals/${partner}`, {
            headers,
            data: {
              commissionMode: "dated_percentage",
              commissionPackages: [
                {
                  key: "bad",
                  name: "bad",
                  effectiveFrom: "2026-06-15",
                  kind: "percentage",
                  bookingCurrency: "*",
                  rates: [{ effectiveFrom: "2026-06-14", ratePercent: 20 }],
                },
              ],
            },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await request.get(api + `/referrals/report?referralId=${partner}`)
        ).status(),
      ).toBe(401);
      await db
        .collection("retreatexpenses")
        .insertOne({
          _id: expense,
          referralId: partner,
          retreatId: retreat,
          status: "paid",
          expenseKind: "actual",
          amount: 123,
          currency: "PLN",
          expenseDate: new Date(),
          referralPayoutItems: [
            {
              bookingId: bookings[0],
              clientId: clients[0],
              amount: 123,
              currency: "PLN",
              commissionPercentage: 7,
              commissionKind: "percentage",
              packageName: "Recorded agreement",
            },
          ],
        });
      await page.getByLabel("New percentage", { exact: true }).fill("25");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(
        page.getByText("Referral saved.", { exact: true }),
      ).toBeVisible();
      rows = await report();
      expect(row(0)).toMatchObject({
        amountOwed: 123,
        commissionPercentage: 7,
        packageName: "Recorded agreement",
        paid: true,
      });
      expect(row(1).amountOwed).toBe(2375);
      await page.goto(`/admin/referrals/commissions?referralId=${partner}`);
      await expect(
        page.locator("tbody").getByText("Recorded agreement", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: path.resolve(
          `test-results/referral-date-packages/commissions-${width}.png`,
        ),
        fullPage: true,
      });
      await page.goto(`/admin/referrals/${partner}/edit`);
      await page
        .getByRole("button", { name: "Remove package", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(
        page.getByText("Referral saved.", { exact: true }),
      ).toBeVisible();
      rows = await report();
      expect(row(1).commissionIssue).toBeTruthy(); // Removing packages cannot revive the legacy 10% default.
      expect(row(0)).toMatchObject({
        amountOwed: 123,
        commissionPercentage: 7,
        paid: true,
      });
    } finally {
      await db.collection("retreatexpenses").deleteOne({ _id: expense });
      await db
        .collection("retreatclients")
        .deleteMany({ _id: { $in: bookings } });
      await db.collection("clients").deleteMany({ _id: { $in: clients } });
      await db.collection("referrals").deleteOne({ _id: partner });
      await db.collection("retreats").deleteOne({ _id: retreat });
    }
  });
