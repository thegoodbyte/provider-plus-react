import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixturePath = process.env.CLIENT_EKG_MRR_FIXTURE;
const f = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, "utf8")) : {};
test.skip(
  !fixturePath,
  "Requires disposable client EKG MRR real Nest/Mongo fixture",
);
for (const [index, width] of [1440, 390].entries())
  test(`client EKG missing MRR creation and persisted status at ${width}px`, async ({
    page,
    request,
  }) => {
    const row = f.cases[index],
      headers = { Authorization: "Bearer " + f.tokens.admin };
    await page.setViewportSize({ width, height: 1080 });
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
    let writes = 0,
      failLookup = true;
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname;
      if (!["xhr", "fetch"].includes(req.resourceType()))
        return route.continue();
      if (path === "/medical-review-requests/by-artifacts" && failLookup)
        return route.fulfill({
          status: 503,
          json: { message: "Synthetic lookup unavailable" },
        });
      if (path.endsWith("/access-links")) return route.fulfill({ json: [] });
      if (
        path.startsWith("/medical-review-requests") ||
        path.startsWith("/medical-artifacts") ||
        path === "/clients" ||
        path === "/clients/" + row.clientId ||
        path === "/users"
      ) {
        if (req.method() === "POST") writes++;
        return route.fulfill({
          response: await route.fetch({ url: f.url + path + url.search }),
        });
      }
      if (path === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (path === "/communications/settings")
        return route.fulfill({
          json: { clientMedicalSubmittedEmailsEnabled: false },
        });
      return route.fulfill({ json: [] });
    });
    const clientUrl = "/admin/clients/" + row.clientId + "?tab=medical";
    await page.goto(clientUrl);
    // The actual tab key is selected below as well, so URL aliases do not hide the card.
    await page
      .getByRole("button", { name: "Medical Info", exact: true })
      .click();
    const card = page.getByRole("region", {
      name: "Entry EKG Test",
      exact: true,
    });
    await expect(card.getByRole("alert")).toContainText(
      "Unable to load MRR status",
    );
    await expect(
      card.getByRole("link", { name: "Create MRR", exact: true }),
    ).toHaveCount(0);
    failLookup = false;
    await card.getByRole("button", { name: "Retry MRR lookup" }).click();
    await expect(
      card.getByRole("link", { name: "Create MRR", exact: true }),
    ).toHaveAttribute(
      "href",
      "/admin/medical-review-requests/new?artifactId=" + row.ekgId,
    );
    for (const n of [1, 2, 3])
      await expect(
        card.getByText("synthetic-ekg-" + n + ".jpg", { exact: true }).first(),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "Dismiss loading message", exact: true })
      .click();
    expect(writes).toBe(0);
    await card.screenshot({
      path: `${process.env.CLIENT_EKG_MRR_ARTIFACT_DIR || "../ppvc-930-validation"}/ekg-missing-${width}.png`,
    });
    await card.getByRole("link", { name: "Create MRR", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Add Medical Review Request" }),
    ).toBeVisible();
    await expect(
      page.getByText("Uploaded Entry EKG " + index, { exact: false }).first(),
    ).toBeVisible();
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="' + f.groupId + '"]') })
      .selectOption(f.groupId);
    await page.getByRole("button", { name: /Synthetic Advisor/ }).click();
    await page
      .getByRole("checkbox", { name: /Notify medical reviewer now/ })
      .uncheck();
    await page
      .getByRole("checkbox", { name: /Notify client when submitted/ })
      .uncheck();
    await page
      .getByRole("button", { name: "Create Request", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("MRR created");
    expect(writes).toBe(1);
    const snapshot = await (
      await request.get(f.url + "/fixture/snapshot")
    ).json();
    const created = snapshot.requests.filter((r: any) =>
      r.artifactIds.includes(row.ekgId),
    );
    expect(created).toHaveLength(1);
    expect(created[0].clientId).toBe(row.clientId);
    expect(created[0].status).toBe("pending");
    expect(
      snapshot.requests.find((r: any) => r._id === row.liverReviewId)
        .reviewDecision,
    ).toBe("OK");
    expect(
      snapshot.artifacts.find((a: any) => a._id === row.ekgId).files,
    ).toHaveLength(3);
    await page.goto(clientUrl);
    await page
      .getByRole("button", { name: "Medical Info", exact: true })
      .click();
    await expect(
      card.getByRole("link", {
        name: "MRR #" + created[0].display_id,
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      "/admin/medical-review-requests/" + created[0]._id,
    );
    await expect(card).toContainText("pending");
    await expect(
      card.getByRole("link", { name: "Create MRR", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      card.getByRole("link", {
        name: "MRR #" + created[0].display_id,
        exact: true,
      }),
    ).toBeVisible();
    await card.screenshot({
      path: `${process.env.CLIENT_EKG_MRR_ARTIFACT_DIR || "../ppvc-930-validation"}/ekg-linked-${width}.png`,
    });
    const persisted = await request.get(
      f.url + "/medical-review-requests/" + created[0]._id,
      { headers },
    );
    expect(persisted.ok()).toBeTruthy();
  });
