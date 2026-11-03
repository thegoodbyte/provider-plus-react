import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const file = process.env.SETTLED_SCRATCHPAD_FIXTURE,
  f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Use scripts/run-settled-scratchpad-e2e.cjs with a built API/local MongoDB.",
);
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`SP36 existing settled payment by Ewa/PR1402 at ${width}px`, async ({
    page,
    request,
  }) => {
    test.setTimeout(60000);
    const reset = await request.post(f.url + "/fixture/settled-reset");
    const { ids } = await reset.json();
    const before = await (
      await request.get(f.url + "/fixture/settled-snapshot")
    ).json();
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
      const r = route.request(),
        u = new URL(r.url());
      if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
      if (u.pathname.startsWith("/payment-scratchpad"))
        return route.fulfill({
          response: await route.fetch({ url: f.url + u.pathname + u.search }),
        });
      if (!["GET", "HEAD"].includes(r.method()))
        throw Error("Unexpected write " + u.pathname);
      if (u.pathname === "/clients")
        return route.fulfill({ json: before.clients });
      if (u.pathname === "/payment-requests")
        return route.fulfill({ json: before.requests });
      if (u.pathname === "/bookings")
        return route.fulfill({ json: before.bookings });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto(
      "/admin/payments/scratchpad/" + ids.receipts[0] + "?match=1",
    );
    const panel = page.getByRole("region", {
      name: "Guided scratchpad matching",
    });
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "PR number", exact: true }).click();
    await expect(
      panel.getByRole("checkbox", { name: "Select PR #1402" }),
    ).toBeDisabled();
    await panel
      .getByRole("button", { name: "Find existing payments for PR #1402" })
      .click();
    await expect(
      panel.getByRole("checkbox", { name: "Select payment #1211" }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Search all requests" }).click();
    const search = panel.getByRole("textbox", {
      name: "Client name, payment / PR / booking number or reference",
    });
    await search.fill("Ewa Franus");
    await expect(
      panel.getByRole("checkbox", { name: "Select payment #1211" }),
    ).toBeVisible();
    await search.fill("PR #1402");
    await expect(
      panel.getByRole("checkbox", { name: "Select payment #1211" }),
    ).toBeEnabled();
    await panel.getByRole("checkbox", { name: "Select payment #1211" }).check();
    const out =
      process.env.SETTLED_SCRATCHPAD_ARTIFACT_DIR ||
      "test-results/settled-scratchpad";
    fs.mkdirSync(out, { recursive: true });
    await panel.screenshot({
      path: path.join(out, `settled-match-${width}.png`),
    });
    await panel
      .getByRole("button", { name: "Confirm link to existing payment" })
      .click();
    await expect
      .poll(async () => {
        const s = await (
          await request.get(f.url + "/fixture/settled-snapshot")
        ).json();
        return s.receipts.find((r: any) => r._id === ids.receipts[0]).status;
      })
      .toBe("converted");
    await page.reload();
    const after = await (
      await request.get(f.url + "/fixture/settled-snapshot")
    ).json();
    expect(after.payments.length).toBe(before.payments.length);
    expect(after.requests).toEqual(before.requests);
    expect(after.bookings).toEqual(before.bookings);
    expect(after.settlement).toEqual(before.settlement);
    expect(after.settlement.settled).toBe(true);
    expect(after.emails).toEqual([]);
    expect(after.pdf).toEqual([]);
    expect(
      after.receipts.find((r: any) => r._id === ids.receipts[1]).status,
    ).toBe("unassigned");
  });
