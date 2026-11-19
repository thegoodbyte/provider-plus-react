import { test, expect } from "./fixtures/medical-review-workspace";
const id = "000000000000000000000032";
for (const width of [1440, 390])
  test(`WhatsApp saves pass production DTO validation and survive reload ${width}`, async ({
    page,
    request,
    reviewWorkspace: f,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const headers = { Authorization: "Bearer " + f.tokens.admin };
    const sibling = JSON.stringify(
      await f.models.MedicalReviewRequest.findOne({ display_id: 9051 }).lean(),
    );
    const invalid = await request.patch(
      f.url + "/medical-review-requests/" + id,
      { headers, data: { advisorDeliveryStatus: "sent" } },
    );
    expect(invalid.status()).toBe(400);
    expect(await invalid.text()).toContain(
      "property advisorDeliveryStatus should not exist",
    );
    await page.goto("/admin/medical-review-requests");
    await page
      .getByRole("textbox", { name: "Search review requests", exact: true })
      .fill("9050");
    await page
      .getByRole("button", { name: "Handle via WhatsApp", exact: true })
      .click();
    const d = page.getByRole("dialog", {
      name: "WhatsApp · MRR #9050",
      exact: true,
    });
    await expect(d).toBeVisible();
    await d.getByLabel("Date sent", { exact: true }).fill("2026-10-13");
    await d
      .getByRole("button", { name: "Save and return to list", exact: true })
      .click();
    await expect(d).toHaveCount(0);
    await page.reload();
    await page
      .getByRole("textbox", { name: "Search review requests", exact: true })
      .fill("9050");
    await page
      .getByRole("button", { name: "WhatsApp: awaiting answer", exact: true })
      .click();
    await d
      .getByLabel("WhatsApp status", { exact: true })
      .selectOption("responded");
    await d.getByLabel("Date answered", { exact: true }).fill("2026-10-14");
    await d.getByLabel("Advisor result", { exact: true }).selectOption("OK");
    await d
      .getByLabel("What did the advisor say?", { exact: true })
      .fill("Synthetic advisor response");
    await d
      .getByRole("button", { name: "Save and return to list", exact: true })
      .click();
    await expect(d).toHaveCount(0);
    const saved = await f.models.MedicalReviewRequest.findById(id).lean();
    expect(saved.status).toBe("approved");
    expect(saved.whatsappDecision).toBe("OK");
    expect(saved.reviewNotes).toBe("Synthetic advisor response");
    await page.reload();
    await page
      .getByRole("button", { name: "WhatsApp handled", exact: true })
      .click();
    await expect(
      page.getByText("Synthetic advisor response", { exact: true }),
    ).toBeVisible();
    expect(
      JSON.stringify(
        await f.models.MedicalReviewRequest.findOne({
          display_id: 9051,
        }).lean(),
      ),
    ).toBe(sibling);
  });
for (const width of [1440, 390])
  test(`detailed MRR WhatsApp result validates and reloads ${width}`, async ({
    page,
    reviewWorkspace: f,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin/medical-review-requests/" + id);
    await page.getByLabel("Handle this review via WhatsApp").check();
    await page
      .getByRole("combobox", { name: "Medical advisor", exact: true })
      .selectOption("000000000000000000000386");
    await page.getByLabel("Date sent", { exact: true }).fill("2026-10-13");
    await page
      .getByRole("combobox", { name: "WhatsApp status", exact: true })
      .selectOption("responded");
    await page
      .getByLabel("Date approved/answered", { exact: true })
      .fill("2026-10-14");
    await page
      .getByRole("combobox", { name: "Advisor result", exact: true })
      .selectOption("OK");
    await page
      .getByPlaceholder("What the advisor said over WhatsApp (optional)")
      .fill("Synthetic detailed response");
    await page
      .getByRole("button", { name: "Save WhatsApp status", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await f.models.MedicalReviewRequest.findById(id).lean()).status,
      )
      .toBe("approved");
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Advisor result", exact: true }),
    ).toHaveValue("OK");
    await expect(
      page.getByLabel("Date approved/answered", { exact: true }),
    ).toHaveValue("2026-10-14");
    await expect(
      page.getByPlaceholder("What the advisor said over WhatsApp (optional)"),
    ).toHaveValue("Synthetic detailed response");
  });
