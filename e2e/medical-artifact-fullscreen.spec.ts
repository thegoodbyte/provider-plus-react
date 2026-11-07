import { test, expect } from "@playwright/test";
// A complete minimal PDF exercises the browser renderer without any real medical data.
function pdf(label: string) {
  const content = `BT /F1 24 Tf 50 750 Td (${label}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n",
    offsets = [0];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = Buffer.byteLength(body);
  body +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(body);
}
for (const width of [1440, 390])
  test(`questionnaire original and English fill the viewport, retry safely and restore focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const original = "medical-artifacts/questionnaire/original.pdf",
      english = "medical-artifacts/questionnaire/english.pdf";
    const artifact = {
      _id: "artifact-998",
      display_id: 1420,
      artifactType: "questionnaire",
      title: "Synthetic initial questionnaire",
      status: "stored",
      source: "admin_upload",
      version: 1,
      contextType: "client",
      documentStage: "entry",
      documentType: "additional",
      originalLanguage: "pl",
      clientId: {
        _id: "client-998",
        display_id: 1333,
        firstName: "Synthetic",
        lastName: "Client",
      },
      files: [
        {
          s3Key: original,
          fileName: "original.pdf",
          mimeType: "application/pdf",
          size: 700,
        },
        {
          s3Key: english,
          fileName: "english.pdf",
          mimeType: "application/pdf",
          size: 700,
          variant: "english_translation",
        },
      ],
      translation: { status: "ready", sourceLanguage: "pl" },
    };
    await page.addInitScript(() => {
      localStorage.setItem("token", "synthetic-viewer-token");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "staff-viewer",
          role: "admin",
          email: "staff@example.invalid",
        }),
      );
    });
    let denyEnglish = false;
    const writes: string[] = [],
      reads: string[] = [];
    await page.route("**/*", async (route) => {
      const r = route.request();
      if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
      const u = new URL(r.url());
      if (r.method() !== "GET") {
        writes.push(r.method() + " " + u.pathname);
        return route.abort();
      }
      if (u.pathname === "/medical-artifacts/artifact-998/files/view") {
        expect(r.headers().authorization).toBe("Bearer synthetic-viewer-token");
        const path = u.searchParams.get("storedPath")!;
        expect([original, english]).toContain(path);
        reads.push(path);
        if (path === english && denyEnglish)
          return route.fulfill({ status: 403, json: { message: "Denied" } });
        return route.fulfill({
          contentType: "application/pdf",
          body: pdf(
            path === english
              ? "Synthetic English version"
              : "Synthetic original version",
          ),
        });
      }
      if (u.pathname === "/medical-artifacts/artifact-998")
        return route.fulfill({ json: artifact });
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (
        u.pathname.includes("config-summary") ||
        u.pathname.includes("navigation-permissions")
      )
        return route.fulfill({ json: {} });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/medical-artifacts/artifact-998");
    const openEnglish = page.getByRole("button", {
      name: "Open English document full screen: english.pdf",
      exact: true,
    });
    await openEnglish.scrollIntoViewIfNeeded();
    await openEnglish.click();
    let dialog = page.getByRole("dialog", {
      name: "Full-screen document viewer",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("opacity", "1");
    await expect(
      dialog.getByRole("button", { name: "Close viewer", exact: true }),
    ).toBeFocused();
    await expect(dialog.getByLabel("Document version")).toHaveValue(english);
    await expect(
      dialog.getByTitle("Full-screen English · english.pdf"),
    ).toBeVisible();
    expect(reads.at(-1)).toBe(english);
    await expect
      .poll(async () => Math.round((await dialog.boundingBox())!.height))
      .toBeGreaterThanOrEqual(998);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeLessThanOrEqual(1);
    expect(bounds!.y).toBeLessThanOrEqual(1);
    expect(bounds!.width).toBeGreaterThanOrEqual(width - 2);
    expect(bounds!.height).toBeGreaterThanOrEqual(998);
    const frame = dialog.getByTitle("Full-screen English · english.pdf"),
      fb = await frame.boundingBox();
    expect(fb!.width).toBeGreaterThanOrEqual(width - 4);
    expect(fb!.height).toBeGreaterThan(500);
    await expect(
      dialog.getByRole("link", { name: "Download document" }),
    ).toHaveAttribute("download", "english.pdf");
    await expect(
      dialog.getByRole("link", { name: "Open in new tab" }),
    ).toHaveAttribute("href", /^blob:/);
    if (process.env.VIEWER_ARTIFACT_DIR)
      await page.screenshot({
        path: process.env.VIEWER_ARTIFACT_DIR + `/english-${width}.png`,
        animations: "disabled",
      });
    await dialog.getByLabel("Document version").selectOption(original);
    await expect(
      dialog.getByTitle("Full-screen Original · original.pdf"),
    ).toBeVisible();
    expect(reads.at(-1)).toBe(original);
    denyEnglish = true;
    await dialog.getByLabel("Document version").selectOption(english);
    await expect(dialog.getByRole("alert")).toContainText("permission");
    await expect(dialog.locator("iframe")).toHaveCount(0);
    await expect(
      dialog.getByRole("link", { name: "Download document" }),
    ).toHaveCount(0);
    denyEnglish = false;
    await dialog.getByRole("button", { name: "Retry document" }).click();
    await expect(
      dialog.getByTitle("Full-screen English · english.pdf"),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Close viewer", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(openEnglish).toBeFocused();
    await page
      .getByRole("button", {
        name: "Open original document full screen: original.pdf",
        exact: true,
      })
      .click();
    dialog = page.getByRole("dialog", {
      name: "Full-screen document viewer",
      exact: true,
    });
    await expect(
      dialog.getByTitle("Full-screen Original · original.pdf"),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Close viewer", exact: true })
      .focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([]);
    await expect(page).toHaveURL(/medical-artifacts\/artifact-998$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.unrouteAll({ behavior: "wait" });
  });
