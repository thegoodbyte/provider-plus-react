import { test, expect } from "@playwright/test";
import fs from "node:fs";
const file = process.env.WHATSAPP_RESULT_FIXTURE,
  f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(!file, "Requires disposable production-schema MRR API fixture.");
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`WhatsApp decision fallback and client profile at ${width}px`, async ({
    page,
    request,
  }) => {
    await request.post(f.url + "/fixture/reset");
    const before = await (
      await request.get(f.url + "/fixture/snapshot")
    ).json();
    const lookup = await (await request.get(f.url + "/fixture/data")).json();
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "admin",
          role: "admin",
          email: "admin@example.invalid",
        }),
      );
    }, f.tokens.admin);
    await page.route("**/*", async (route) => {
      const r = route.request();
      if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
      const u = new URL(r.url()),
        p = u.pathname.replace(/^\/api(?=\/)/, "");
      if (p.endsWith("/context"))
        return route.fulfill({
          response: await route.fetch({ url: f.url + "/fixture/context" }),
        });
      if (p.startsWith("/medical-review-requests"))
        return route.fulfill({
          response: await route.fetch({ url: f.url + p + u.search }),
        });
      if (p === "/clients") return route.fulfill({ json: lookup.clients });
      if (p === "/users") return route.fulfill({ json: lookup.users });
      if (p === "/retreats") return route.fulfill({ json: lookup.retreats });
      if (p === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/medical-review-requests/" + f.requestId);
    const identity = page.getByRole("region", { name: "Review identity" });
    await expect(
      identity.getByRole("link", { name: "Client ID: 1333", exact: true }),
    ).toHaveAttribute("href", "/admin/clients/" + f.clientId);
    await page.goto("/admin/medical-review-requests");
    await page
      .locator(".mrr-list-row")
      .filter({ has: page.getByRole("button", { name: "#1423", exact: true }) })
      .getByTitle("Open the WhatsApp handling form")
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("WhatsApp status", { exact: true })
      .selectOption("responded");
    await dialog
      .getByLabel("Advisor result", { exact: true })
      .selectOption("OK");
    await expect(dialog.getByLabel("What did the advisor say?")).toHaveValue(
      "",
    );
    await dialog
      .getByRole("button", { name: "Save and return to list", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page.goto("/admin/medical-review-requests/" + f.requestId);
    await page.reload();
    let saved = await (await request.get(f.url + "/fixture/snapshot")).json();
    const current = saved.requests.find((r: any) => r._id === f.requestId);
    expect(current.reviewNotes).toBe("OK — medical advisor via WhatsApp");
    expect(current.status).toBe("approved");
    expect(current.whatsappDecision).toBe("OK");
    expect(saved.requests.find((r: any) => r.display_id === 1424)).toEqual(
      before.requests.find((r: any) => r.display_id === 1424),
    );
    await page.goto("/admin/medical-review-requests");
    await page
      .locator(".mrr-list-row")
      .filter({ has: page.getByRole("button", { name: "#1423", exact: true }) })
      .getByTitle("Open the WhatsApp handling form")
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("What did the advisor say?"),
    ).toHaveValue("");
    await page
      .getByRole("dialog")
      .getByLabel("What did the advisor say?")
      .fill("Reviewed the supplied document; no additional observations.");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save and return to list", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/admin/medical-review-requests/" + f.requestId);
    await page.reload();
    saved = await (await request.get(f.url + "/fixture/snapshot")).json();
    expect(
      saved.requests.find((r: any) => r._id === f.requestId).reviewNotes,
    ).toBe("Reviewed the supplied document; no additional observations.");
    await page.goto("/admin/medical-review-requests/000000000000000000000008");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.body.innerText.includes(
              "OK — medical advisor via WhatsApp",
            ) ||
            Array.from(document.querySelectorAll("textarea")).some(
              (e) =>
                e.getClientRects().length &&
                e.value === "OK — medical advisor via WhatsApp",
            ),
        ),
      )
      .toBe(true);
    await identity.screenshot({
      path: `${process.env.WHATSAPP_RESULT_ARTIFACT_DIR || "test-results"}/mrr-client-link-${width}.png`,
    });
    await identity
      .getByRole("link", { name: "Client ID: 1333", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp("/admin/clients/" + f.clientId + "$"),
    );
  });
