import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const fixturePath = process.env.CONTACT_CARD_FIXTURE;
for (const width of [1440, 390])
  test(`client profile exports reviewed contact card at ${width}px`, async ({
    page,
    request,
    baseURL,
  }, info) => {
    test.skip(
      !fixturePath,
      "Start the real contact-card API/MongoDB fixture first",
    );
    const f = JSON.parse(fs.readFileSync(fixturePath!, "utf8")),
      id = f.ids.client;
    const before = await (await request.get(f.url + "/fixture/state")).json();
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "staff",
          role: "admin",
          email: "admin@example.invalid",
        }),
      );
    }, f.tokens.admin);
    await page.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (
        u.origin === new URL(baseURL!).origin &&
        !u.pathname.startsWith("/api/")
      )
        return route.continue();
      const p = u.pathname.replace(/^\/api(?=\/)/, "");
      if (p === `/clients/${id}` || p.startsWith(`/clients/${id}/contact-card`))
        return route.fulfill({
          response: await route.fetch({ url: f.url + p + u.search }),
        });
      let data: any = [];
      if (p === "/environment/status") data = { production: true };
      if (p === "/users/navigation-permissions" || p === "/config-summary")
        data = {};
      if (p === "/submission-notifications/unread-count") data = { count: 0 };
      if (p === "/auth/profile")
        data = { role: "admin", email: "admin@example.invalid" };
      return route.fulfill({ json: data });
    });
    await page.goto(`/admin/clients/${id}`);
    const contactButton = page.getByRole("button", {
      name: "Contact card (.vcf)",
    });
    await expect(contactButton).toBeVisible();
    const buttonBounds = await contactButton.boundingBox();
    expect(buttonBounds!.x).toBeGreaterThanOrEqual(0);
    expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(width);
    await contactButton.click();
    const dialog = page.getByRole("dialog", { name: "Client contact card" });
    await expect(
      dialog.getByRole("region", { name: "Contact card preview" }),
    ).toContainText(`ISCZ-1233 | Adam Smith | AD | R:${f.expectedDate}`);
    for (const format of ["compact", "complete", "name-first", "brackets"]) {
      if (format !== "compact")
        await dialog.getByLabel("Contact name format").selectOption(format);
      const link = dialog.getByRole("link", { name: "Download vCard" });
      await expect(link).toBeVisible();
      const done = page.waitForEvent("download");
      await link.click();
      const file = await done;
      expect(file.suggestedFilename()).toBe("ISCZ-1233.vcf");
      const content = fs.readFileSync((await file.path())!, "utf8"),
        unfolded = content.replace(/\r\n /g, "");
      expect(unfolded).toContain("BEGIN:VCARD\r\nVERSION:3.0");
      expect(unfolded).toContain("ISCZ-1233");
      expect(unfolded).toContain("Adam Smith");
      expect(unfolded).toContain("TEL;TYPE=CELL:+48881745713");
      expect(unfolded).toContain("First contact: 23.03.26");
      expect(unfolded).not.toMatch(/PRIVATE_MEDICAL|PRIVATE_PIN/);
      if (format === "complete") expect(unfolded).toContain("F:23.03.26");
      if (process.env.CONTACT_CARD_ARTIFACTS)
        await file.saveAs(
          path.join(
            process.env.CONTACT_CARD_ARTIFACTS,
            `contact-${width}-${format}.vcf`,
          ),
        );
    }
    await dialog.getByText("Contact notes", { exact: true }).click();
    await expect(dialog.getByText(/Original name: Adam Smith/)).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: process.env.CONTACT_CARD_ARTIFACTS
        ? path.join(process.env.CONTACT_CARD_ARTIFACTS, `contact-${width}.png`)
        : info.outputPath("contact.png"),
    });
    await dialog.getByRole("button", { name: "Close contact card" }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Contact card (.vcf)" }).click();
    await expect(
      page.getByRole("link", { name: "Download vCard" }),
    ).toBeVisible();
    expect(await (await request.get(f.url + "/fixture/state")).json()).toEqual(
      before,
    );
  });
