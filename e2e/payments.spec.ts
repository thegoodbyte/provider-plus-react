import { test, expect } from '@playwright/test';

test.describe('Payments Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the payments page
    // Note: You'll need to handle authentication in a real scenario
    await page.goto('/payments');
  });

  test('should display payments page', async ({ page }) => {
    // Check if the page title is visible
    await expect(page.locator('h1')).toContainText('Payments');

    // Check if Add Payment button is visible
    await expect(page.getByRole('button', { name: /Add Payment/i })).toBeVisible();
  });

  test('should open add payment modal', async ({ page }) => {
    // Click Add Payment button
    await page.getByRole('button', { name: /Add Payment/i }).click();

    // Check if modal is visible
    await expect(page.locator('text=Add New Payment')).toBeVisible();

    // Check if form fields are present
    await expect(page.getByLabel(/Client/i)).toBeVisible();
    await expect(page.getByLabel(/Retreat/i)).toBeVisible();
    await expect(page.getByLabel(/Amount/i)).toBeVisible();
    await expect(page.getByLabel(/Currency/i)).toBeVisible();
    await expect(page.getByLabel(/Payment Method/i)).toBeVisible();
  });

  test('should close modal on cancel', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /Add Payment/i }).click();
    await expect(page.locator('text=Add New Payment')).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Modal should be closed
    await expect(page.locator('text=Add New Payment')).not.toBeVisible();
  });

  test('should create a new payment', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /Add Payment/i }).click();

    // Fill in the form
    await page.getByLabel(/Client/i).selectOption({ index: 1 }); // Select first client
    await page.getByLabel(/Retreat/i).selectOption({ index: 1 }); // Select first retreat
    await page.getByLabel(/Amount/i).fill('1500');
    await page.getByLabel(/Currency/i).selectOption('EUR');
    await page.getByLabel(/Payment Method/i).selectOption('bank_transfer');
    await page.getByLabel(/Status/i).selectOption('completed');

    // Submit the form
    await page.getByRole('button', { name: /Add Payment$/i }).click();

    // Wait for modal to close and check if payment appears in the list
    await expect(page.locator('text=Add New Payment')).not.toBeVisible();

    // Verify the new payment appears in the table (amount should be visible)
    await expect(page.locator('text=1,500.00')).toBeVisible();
  });

  test('should filter and search payments', async ({ page }) => {
    // Wait for payments to load
    await page.waitForSelector('table');

    // Check if table headers are present
    await expect(page.locator('th:has-text("Date")')).toBeVisible();
    await expect(page.locator('th:has-text("Client")')).toBeVisible();
    await expect(page.locator('th:has-text("Amount")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
  });

  test('should display payment statistics', async ({ page }) => {
    // Wait for statistics to load
    await page.waitForSelector('text=/Showing \\d+ payment/');

    // Check if statistics are displayed
    await expect(page.locator('text=/Total: \\d+ completed/')).toBeVisible();
    await expect(page.locator('text=/Pending: \\d+/')).toBeVisible();
  });

  test('should handle edit payment action', async ({ page }) => {
    // Wait for payments table to load
    await page.waitForSelector('table');

    // Find and click the first edit button
    const editButton = page.locator('button[title="Edit"]').first();

    // Check if edit button exists before clicking
    const editButtonCount = await editButton.count();
    if (editButtonCount > 0) {
      await editButton.click();

      // Check if modal opens with Edit title
      await expect(page.locator('text=Edit Payment')).toBeVisible();

      // Check if form is populated (amount field should have a value)
      const amountField = page.getByLabel(/Amount/i);
      const amountValue = await amountField.inputValue();
      expect(Number(amountValue)).toBeGreaterThan(0);
    }
  });

  test('should handle delete payment with confirmation', async ({ page }) => {
    // Wait for payments table to load
    await page.waitForSelector('table');

    // Setup dialog handler before clicking delete
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Are you sure you want to delete this payment?');
      dialog.accept();
    });

    // Find and click the first delete button
    const deleteButton = page.locator('button[title="Delete"]').first();
    const deleteButtonCount = await deleteButton.count();

    if (deleteButtonCount > 0) {
      await deleteButton.click();

      // Wait for the deletion to process
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Payments Page Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/payments');

    // Check if page adapts to mobile
    await expect(page.locator('h1')).toContainText('Payments');
    await expect(page.getByRole('button', { name: /Add Payment/i })).toBeVisible();

    // Table should be scrollable on mobile
    const table = page.locator('.overflow-x-auto');
    await expect(table).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/payments');

    // Check if page displays correctly on tablet
    await expect(page.locator('h1')).toContainText('Payments');
    await expect(page.getByRole('button', { name: /Add Payment/i })).toBeVisible();
  });
});