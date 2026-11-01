import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const file = process.env.SCREENING_WORKSPACE_FIXTURE;
const f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Run scripts/run-screening-workspace-e2e.cjs with a built API and local MongoDB.",
);
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`saved screening motivation/dates, compact sortable search and PDF at ${width}px`, async ({
    page,
    request,
  }) => {
    test.setTimeout(60000);
    await request.post(f.url + "/fixture/reset");
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "staff",
          role: "admin",
          email: "staff@example.invalid",
        }),
      );
    }, f.tokens.admin);
    await page.route("**/*", async (route) => {
      const q = route.request(),
        u = new URL(q.url());
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      if (u.pathname.startsWith("/clients"))
        return route.fulfill({
          response: await route.fetch({ url: f.url + u.pathname + u.search }),
        });
      if (!["GET", "HEAD"].includes(q.method()))
        throw Error("Unexpected write " + q.method() + " " + u.pathname);
      if (u.pathname === "/room-inventory/options")
        return route.fulfill({
          json: [
            {
              key: "shared",
              active: true,
              labels: { en: "Shared room" },
              legacyRoomType: "shared",
            },
          ],
        });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/clients/" + f.ids.client + "/screening");
    const intent = page.getByRole("textbox", {
      name: "Main intent / motivation",
    });
    await expect(intent).toBeVisible();
    await expect(
      page.getByLabel("Screening date", { exact: true }),
    ).toHaveValue("");
    await page.getByLabel("Screening date", { exact: true }).fill("2024-02-29");
    await intent.fill("Reconnect with my family");
    // Existing room selection remains required by canonical screening validation.
    await page
      .getByRole("combobox", { name: /Desired accommodation/i })
      .selectOption("shared");
    await page
      .getByRole("button", {
        name: "Save screening without leaving this page",
        exact: true,
      })
      .last()
      .click();
    await expect
      .poll(async () => {
        const r = await request.get(f.url + "/fixture/snapshot");
        return (await r.json()).clients.find((c: any) => c._id === f.ids.client)
          .screeningData?.mainIntent;
      })
      .toBe("Reconnect with my family");
    let snapshot = await (
      await request.get(f.url + "/fixture/snapshot")
    ).json();
    let row = snapshot.clients.find((c: any) => c._id === f.ids.client);
    expect(row.screeningCompletedDate).toBeNull();
    expect(row.screeningUpdatedAt).toBeTruthy();
    await page.reload();
    await expect(intent).toHaveValue("Reconnect with my family");
    await expect(
      page.getByLabel("Screening date", { exact: true }),
    ).toHaveValue("2024-02-29");
    // Outcome radio/select is the existing completion decision.
    await page.getByRole("button", { name: "Accepted", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Save screening without leaving this page",
        exact: true,
      })
      .last()
      .click();
    await expect
      .poll(async () => {
        const s = await (await request.get(f.url + "/fixture/snapshot")).json();
        return s.clients.find((c: any) => c._id === f.ids.client)
          .screeningCompletedDate;
      })
      .toBeTruthy();
    snapshot = await (await request.get(f.url + "/fixture/snapshot")).json();
    const completion = snapshot.clients.find(
      (c: any) => c._id === f.ids.client,
    ).screeningCompletedDate;
    await intent.fill("Reconnect with family after review");
    await page
      .getByRole("button", {
        name: "Save screening without leaving this page",
        exact: true,
      })
      .last()
      .click();
    await expect
      .poll(async () => {
        const s = await (await request.get(f.url + "/fixture/snapshot")).json();
        return s.clients.find((c: any) => c._id === f.ids.client).screeningData
          .mainIntent;
      })
      .toBe("Reconnect with family after review");
    const history = page.getByRole("region", { name: "Screening history" });
    await expect(history).toContainText("Completed:");
    const out =
      process.env.SCREENING_WORKSPACE_ARTIFACT_DIR ||
      "test-results/screening-workspace";
    fs.mkdirSync(out, { recursive: true });
    await history.evaluate((e) =>
      e.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await history.screenshot({
      path: path.join(out, `screening-history-${width}.png`),
    });
    const pdf = await request.get(
      f.url + "/clients/" + f.ids.client + "/screening/pdf",
      { headers: { Authorization: "Bearer " + f.tokens.admin } },
    );
    expect(pdf.ok()).toBeTruthy();
    fs.writeFileSync(
      path.join(out, `screening-${width}.pdf`),
      await pdf.body(),
    );
    await page.goto("/admin/screening");
    await expect(
      page.getByRole("button", { name: "Screening date", exact: true }),
    ).toBeVisible();
    for (const name of ["Email", "Priority", "First Contact", "Motivation"])
      await expect(
        page.getByRole("columnheader", { name, exact: true }),
      ).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Search screening clients" })
      .fill("after review");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    for (const name of [
      "Name",
      "ID",
      "Screening date",
      "Country",
      "Phone",
      "Status",
      "Completed",
      "Updated",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(
        page.getByRole("columnheader", { name, exact: true }),
      ).toHaveAttribute("aria-sort", "ascending");
    }
    await page
      .getByRole("textbox", { name: "Search screening clients" })
      .fill("");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.locator("table").evaluate((table) => {
      (document.activeElement as HTMLElement)?.blur();
      table.parentElement!.scrollTo({ left: 0, behavior: "instant" });
    });
    await page.waitForFunction(
      () => document.querySelector("table")?.parentElement?.scrollLeft === 0,
    );
    await page.screenshot({
      path: path.join(out, `screening-grid-${width}.png`),
      animations: "disabled",
    });
    snapshot = await (await request.get(f.url + "/fixture/snapshot")).json();
    row = snapshot.clients.find((c: any) => c._id === f.ids.client);
    expect(row.screeningCompletedDate).toBe(completion);
    expect(snapshot.bookings).toBe(0);
    expect(snapshot.effects).toEqual([]);
    expect(
      snapshot.clients.find((c: any) => c._id === f.ids.sibling).screeningData
        .mainIntent,
    ).toBe("Legacy motivation");
  });
