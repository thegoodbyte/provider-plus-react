import { test, expect } from "@playwright/test";
import path from "node:path";

test("follow-up persists through the real local API, MongoDB and Home", async ({
  page,
  request,
}) => {
  const root = path.resolve(process.env.TEST_API_CHECKOUT || "../api");
  const f = await require(
    path.join(root, "test/medical-review-workspace.fixture.cjs"),
  ).createFixture();
  try {
    await f.app.listen(0, "127.0.0.1");
    const api = await f.app.getUrl(),
      headers = { Authorization: "Bearer " + f.tokens.admin };
    const mrrId = "000000000000000000000032",
      displayId = 9050;
    await f.models.MedicalReviewRequest.updateOne(
      { _id: mrrId },
      { $set: { status: "approved" } },
    );
    const sibling = JSON.stringify(
      await f.models.MedicalReviewRequest.findOne({ display_id: 9051 }).lean(),
    );
    expect(
      (
        await request.patch(
          `${api}/medical-review-requests/${mrrId}/follow-up`,
          { data: { followUpRequired: true } },
        )
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.patch(
          `${api}/medical-review-requests/${mrrId}/follow-up`,
          { headers, data: { followUpRequired: "false" } },
        )
      ).status(),
    ).toBe(400);
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "admin@example.invalid" }),
      );
    }, f.tokens.admin);
    await page.route("**/*", async (route) => {
      const q = route.request(),
        u = new URL(q.url());
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      if (
        u.pathname.startsWith("/medical-review-requests") ||
        u.pathname.startsWith("/assistant/")
      )
        return route.fulfill({
          response: await route.fetch({ url: api + u.pathname + u.search }),
        });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(`/admin/medical-review-requests/${mrrId}`);
    const flag = page.getByRole("button", {
      name: `Flag for follow-up: MRR #${displayId}`,
      exact: true,
    });
    await expect(flag).toBeVisible();
    await flag.click();
    const clear = page.getByRole("button", {
      name: `Clear follow-up for MRR #${displayId}`,
      exact: true,
    });
    await expect(clear).toHaveAttribute("aria-pressed", "true");
    const saved = await f.models.MedicalReviewRequest.findById(mrrId).lean();
    expect(saved.followUpRequired).toBe(true);
    expect(saved.status).toBe("approved");
    expect(saved.followUpUpdatedAt).toBeInstanceOf(Date);
    await page.reload();
    await expect(clear).toBeVisible();
    const tasks = await request.get(api + "/assistant/tasks-for-today", {
      headers,
    });
    expect(tasks.ok(), await tasks.text()).toBeTruthy();
    expect(
      (await tasks.json()).tasks.some(
        (x: any) => x.reviewLink === `/admin/medical-review-requests/${mrrId}`,
      ),
    ).toBe(true);
    await page.goto("/admin/launcher");
    await expect(
      page.getByText(`MRR #${displayId} flagged for follow-up`),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "View all MRR follow-ups", exact: true })
      .click();
    await expect(page.getByLabel("Follow-up only")).toBeChecked();
    await page
      .getByRole("button", {
        name: `Clear follow-up for MRR #${displayId}`,
        exact: true,
      })
      .filter({ visible: true })
      .click();
    await expect
      .poll(async () =>
        Boolean(
          (await f.models.MedicalReviewRequest.findById(mrrId).lean())
            .followUpRequired,
        ),
      )
      .toBe(false);
    expect(
      JSON.stringify(
        await f.models.MedicalReviewRequest.findOne({
          display_id: 9051,
        }).lean(),
      ),
    ).toBe(sibling);
    expect(
      await f.models.AuditLog.countDocuments({
        entityId: mrrId,
        action: "medical_review_follow_up_updated",
      }),
    ).toBe(2);
  } finally {
    // Drain pending proxy responses before their real local API closes.
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
