import { test, expect } from "./fixtures/client-workspace";
import { medicalWorkspace } from "./fixtures/medical-workspace";

test("opens the detail view from the artifact list and saves admin notes", async ({
  page,
  clientWorkspace: f,
  request,
}) => {
  const medical = await medicalWorkspace(f);
  try {
    const common = {
      clientId: f.ids.client,
      artifactType: "ekg",
      documentType: "EKG",
      documentStage: "entry",
      contextType: "client",
      status: "stored",
      source: "admin_upload",
      receivedAt: new Date("2026-05-25T10:00:00Z"),
    };
    const artifact = await f.models.MedicalArtifact.create({
      ...common,
      display_id: 1042,
      title: "Entry EKG",
      notes: "Original admin note",
      files: [
        {
          fileName: "entry-ekg.pdf",
          s3Key: "synthetic/entry-ekg.pdf",
          mimeType: "application/pdf",
          size: 100,
        },
      ],
    });
    const sibling = await f.models.MedicalArtifact.create({
      ...common,
      display_id: 1043,
      title: "Sibling EKG",
      notes: "Keep this note",
    });
    const before = JSON.parse(
      JSON.stringify(
        await f.models.MedicalArtifact.findById(sibling._id).lean(),
      ),
    );
    await page.route("**/*", async (route) => {
      if (!["xhr", "fetch"].includes(route.request().resourceType()))
        return route.fallback();
      const u = new URL(route.request().url());
      if (u.pathname.startsWith("/medical-artifacts"))
        return route.fulfill({
          response: await route.fetch({
            url: medical.url + u.pathname + u.search,
          }),
        });
      return route.fallback();
    });
    await page.goto("/admin/medical-artifacts");
    await page
      .getByRole("checkbox", { name: "Future retreats only", exact: true })
      .uncheck();
    await page
      .getByRole("row")
      .filter({ hasText: "#1042" })
      .getByTitle("View artifact", { exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp("/medical-artifacts/" + artifact._id + "$"),
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const note = "Reviewed storage path and ready for provider review.";
    await page
      .getByRole("textbox", { name: "Admin notes", exact: true })
      .fill(note);
    let failed = false;
    await page.route(`**/medical-artifacts/${artifact._id}`, async (route) => {
      if (route.request().method() === "PATCH" && !failed) {
        failed = true;
        return route.fulfill({
          status: 503,
          json: { message: "Synthetic notes outage" },
        });
      }
      return route.fallback();
    });
    await page
      .getByRole("button", { name: "Save Changes", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /Synthetic notes outage|temporarily unavailable/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Admin notes", exact: true }),
    ).toHaveValue(note);
    await page
      .getByRole("button", { name: "Save Changes", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await f.models.MedicalArtifact.findById(artifact._id).lean()).notes,
      )
      .toBe(note);
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Admin notes", exact: true }),
    ).toHaveValue(note);
    expect(
      JSON.parse(
        JSON.stringify(
          await f.models.MedicalArtifact.findById(sibling._id).lean(),
        ),
      ),
    ).toEqual(before);
    const denied = await request.patch(
      medical.url + "/medical-artifacts/" + artifact._id,
      {
        headers: { Authorization: "Bearer " + f.tokens.denied },
        data: { notes: "Do not save" },
      },
    );
    expect(denied.status()).toBe(403);
    expect(
      (await f.models.MedicalArtifact.findById(artifact._id).lean()).notes,
    ).toBe(note);
  } finally {
    await medical.close();
  }
});
