import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const auditPath = process.env.PPVC894_AUDIT;
const audit = auditPath ? JSON.parse(readFileSync(auditPath, "utf8")) : {};
const engines = (audit.chunks || [])
  .filter((c: any) =>
    c.modules.some((m: any) =>
      /node_modules\/(jspdf|html2canvas)\//.test(m.id),
    ),
  )
  .map((c: any) => c.file);
test.skip(!auditPath, "Requires the local PPVC-894 candidate bundle audit.");
for (const fail of [false, true])
  test(
    fail
      ? "deferred PDF failure stays recoverable on mobile"
      : "PDF engines load on export and produce a real download",
    async ({ page }) => {
      await page.setViewportSize({ width: fail ? 390 : 1440, height: 1000 });
      const loaded: string[] = [];
      let block = fail;
      await page.addInitScript(() => {
        localStorage.setItem("token", "synthetic-local-token");
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: "synthetic",
            role: "admin",
            email: "staff@example.invalid",
          }),
        );
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          url.origin === new URL(process.env.SMOKE_BASE_URL!).origin &&
          !url.pathname.startsWith("/api/")
        ) {
          if (engines.some((file: string) => url.pathname.endsWith(file))) {
            loaded.push(url.pathname);
            if (block) {
              block = false;
              return route.abort("failed");
            }
          }
          return route.continue();
        }
        const p = url.pathname.replace(/^\/api(?=\/)/, "");
        return route.fulfill({
          json:
            p === "/client-food-forms"
              ? [
                  {
                    _id: "food-1",
                    display_id: 1894,
                    signature_name: "Synthetic Visitor",
                    email: "fixture@example.invalid",
                    language: "en",
                    status: "submitted",
                    retreat_id: { _id: "retreat-1", code: "P894" },
                    answers: { dietType: "Vegan", allergies: "None" },
                  },
                ]
              : p === "/environment/status"
                ? { production: false }
                : [],
        });
      });
      const open = async () => {
        await page.goto("/admin/client-food-forms");
        await page.getByRole("combobox", { name: "Retreat" }).fill("P894");
        await page.getByRole("option", { name: "P894" }).click();
        await page
          .getByRole("button", { name: "Food matrix", exact: true })
          .click();
      };
      await open();
      expect(loaded).toEqual([]);
      if (fail) {
        await page
          .getByRole("button", { name: "Download PDF", exact: true })
          .click();
        await expect(page.getByRole("alert")).toContainText(
          "Could not create the PDF",
        );
        await expect(
          page.getByRole("dialog", { name: "Food matrix" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Download PDF", exact: true }),
        ).toBeEnabled();
        await page.screenshot({
          path: "../ppvc-894-validation/pdf-failure-mobile.png",
          fullPage: true,
        });
        await open();
      }
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download PDF", exact: true })
        .click();
      const file = await download;
      expect(file.suggestedFilename()).toBe("food-matrix-P894.pdf");
      const saved = `../ppvc-894-validation/food-matrix-${fail ? "recovered" : "desktop"}.pdf`;
      await file.saveAs(saved);
      expect(readFileSync(saved).subarray(0, 5).toString()).toBe("%PDF-");
      expect(loaded.length).toBeGreaterThan(0);
      await page.screenshot({
        path: `../ppvc-894-validation/pdf-${fail ? "recovered-mobile" : "desktop"}.png`,
        fullPage: true,
      });
    },
  );
