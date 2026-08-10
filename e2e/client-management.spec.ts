import { test, expect } from '@playwright/test';

test.skip(process.env.PLAYWRIGHT_LIVE !== '1', 'Requires a seeded live API and authorized test credentials');

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/clients');
    await page.waitForLoadState('networkidle');
  });

  test('should display clients page with display_id column', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible();

    // Check if display_id column exists
    await expect(page.locator('th').filter({ hasText: 'ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Client/i })).toBeVisible();
  });

  test('should create a new client with display_id auto-generation', async ({ page }) => {
    // Click Add Client button
    await page.getByRole('button', { name: /Add Client/i }).click();

    // Check if modal opens
    await expect(page.locator('text=Add New Client')).toBeVisible();

    // Verify display_id field is first field and has auto-generation placeholder
    const displayIdField = page.getByLabel(/Client ID/i);
    await expect(displayIdField).toBeVisible();
    await expect(displayIdField).toHaveAttribute('placeholder', /Auto-generated.*1001/);

    // Fill in required fields (leaving display_id empty for auto-generation)
    await page.getByLabel(/First Name/i).fill('John');
    await page.getByLabel(/Last Name/i).fill('Doe');
    await page.getByLabel(/Email/i).fill('john.doe.test@example.com');
    await page.getByLabel(/Phone/i).fill('1234567890');
    await page.getByLabel(/Country/i).selectOption('USA');

    // Submit the form
    await page.getByRole('button', { name: /Add Client$/i }).click();

    // Wait for modal to close and refresh
    await expect(page.locator('text=Add New Client')).not.toBeVisible();
    await page.waitForTimeout(2000);

    // Verify client appears in the table with display_id
    await expect(page.locator('text=John Doe')).toBeVisible();

    // Check that display_id is visible (should be 4+ digits starting from 1001)
    const displayIdCell = page.locator('tr').filter({ hasText: 'John Doe' }).locator('td').first();
    const displayIdText = await displayIdCell.textContent();
    expect(displayIdText).toMatch(/\d{4,}/); // At least 4 digits
  });

  test('should allow manual display_id override with uniqueness validation', async ({ page }) => {
    // Click Add Client button
    await page.getByRole('button', { name: /Add Client/i }).click();

    // Fill display_id manually
    await page.getByLabel(/Client ID/i).fill('9999');
    await page.getByLabel(/First Name/i).fill('Jane');
    await page.getByLabel(/Last Name/i).fill('Smith');
    await page.getByLabel(/Email/i).fill('jane.smith.test@example.com');
    await page.getByLabel(/Phone/i).fill('0987654321');
    await page.getByLabel(/Country/i).selectOption('UK');

    // Submit the form
    await page.getByRole('button', { name: /Add Client$/i }).click();

    // Wait and verify client is created with custom display_id
    await expect(page.locator('text=Add New Client')).not.toBeVisible();
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Jane Smith')).toBeVisible();

    // Verify the custom display_id appears
    const displayIdCell = page.locator('tr').filter({ hasText: 'Jane Smith' }).locator('td').first();
    await expect(displayIdCell).toContainText('9999');
  });

  test('should search clients by display_id', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('table');

    // Get the search input (assuming there's a search field)
    const searchInput = page.getByPlaceholder(/Search/i);
    if (await searchInput.isVisible()) {
      // Search by display_id
      await searchInput.fill('9999');
      await page.waitForTimeout(1000);

      // Should show filtered results
      await expect(page.locator('text=Jane Smith')).toBeVisible();
    }
  });

  test('should edit client display_id', async ({ page }) => {
    // Find a client row and click edit
    const editButton = page.locator('button[title*="Edit"], button').filter({ hasText: /edit/i }).first();

    if (await editButton.count() > 0) {
      await editButton.click();

      // Check if edit modal opens
      await expect(page.locator('text=Edit Client')).toBeVisible();

      // Verify display_id field is editable
      const displayIdField = page.getByLabel(/Client ID/i);
      await expect(displayIdField).toBeVisible();

      // Change display_id
      await displayIdField.fill('8888');

      // Submit changes
      await page.getByRole('button', { name: /Update|Save/i }).click();

      // Verify changes saved
      await expect(page.locator('text=Edit Client')).not.toBeVisible();
      await page.waitForTimeout(1000);
    }
  });

  test('should handle workflow status changes', async ({ page }) => {
    await page.waitForSelector('table');

    // Check for workflow status filters
    const potentialTab = page.getByText('Potential');
    const activeTab = page.getByText('Active');

    if (await potentialTab.isVisible()) {
      await potentialTab.click();
      await page.waitForTimeout(1000);

      // Should show potential clients
      await expect(page.locator('table')).toBeVisible();
    }

    if (await activeTab.isVisible()) {
      await activeTab.click();
      await page.waitForTimeout(1000);

      // Should show active clients
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('should display client details view', async ({ page }) => {
    await page.waitForSelector('table');

    // Click on a client name or view button
    const viewButton = page.locator('button[title*="View"], a').first();

    if (await viewButton.count() > 0) {
      await viewButton.click();

      // Should show client detail view
      await expect(page.locator('text=Client Details')).toBeVisible();

      // Should have back button
      await expect(page.getByRole('button', { name: /Back/i })).toBeVisible();
    }
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    await expect(page.locator('h1')).toContainText('Client Management');

    // Table should be scrollable on mobile
    const table = page.locator('.overflow-x-auto, table');
    await expect(table).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();

    await expect(page.locator('h1')).toContainText('Client Management');
    await expect(page.getByRole('button', { name: /Add Client/i })).toBeVisible();
  });
});
