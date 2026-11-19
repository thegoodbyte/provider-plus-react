import { Page, expect } from "@playwright/test";
export async function openClientForm(page: Page) {
  await page.goto("/admin/clients");
  await page.getByRole("button", { name: "Add Client", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add New Client",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
export async function fillClientForm(page: Page, marker: string) {
  const dialog = page.getByRole("dialog", {
    name: "Add New Client",
    exact: true,
  });
  await dialog.getByLabel("First Name *", { exact: true }).fill("Synthetic");
  await dialog.getByLabel("Last Name *", { exact: true }).fill(marker);
  await dialog.getByLabel("Phone *", { exact: true }).fill("+420 777 123 456");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill(marker.toLowerCase() + "@example.invalid");
  return dialog;
}
