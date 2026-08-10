import { test, expect } from '@playwright/test';

test.skip(process.env.PLAYWRIGHT_LIVE !== '1', 'Requires a seeded live API and authorized test credentials');

test.describe('Retreat Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/retreats');
    await page.waitForLoadState('networkidle');
  });

  test('should display retreats page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Retreats');

    // Check if retreats grid/table is visible
    await expect(page.locator('.retreat-grid, table, .grid')).toBeVisible();
  });

  test('should navigate to retreat detail view', async ({ page }) => {
    // Wait for retreats to load
    await page.waitForSelector('table, .grid, .retreat-item');

    // Click on first retreat (could be a link, button, or clickable element)
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();

      // Should navigate to retreat detail view
      await expect(page.locator('text=Retreat Clients, text=📋')).toBeVisible();

      // Should have back button
      await expect(page.getByRole('button', { name: /Back to Retreats/i })).toBeVisible();

      // Should have Quick Book Client button
      await expect(page.getByRole('button', { name: /Quick Book Client/i })).toBeVisible();

      // Should have the new Add Existing Client button
      await expect(page.getByRole('button', { name: /Add Existing Client/i })).toBeVisible();
    }
  });

  test('should create quick booking for new client', async ({ page }) => {
    // Navigate to a retreat detail page first
    await page.waitForSelector('table, .grid, .retreat-item');
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();

      // Wait for the page to load
      await page.waitForSelector('button[class*="add-booking-btn"], button:has-text("Quick Book Client")');

      // Click Quick Book Client button
      await page.getByRole('button', { name: /Quick Book Client/i }).click();

      // Check if modal opens
      await expect(page.locator('text=Quick Book Client for Retreat')).toBeVisible();

      // Fill in the form
      await page.getByLabel(/First Name/i).fill('Test');
      await page.getByLabel(/Last Name/i).fill('User');
      await page.getByLabel(/Phone Number/i).fill('1234567890');
      await page.getByLabel(/Email/i).fill('test.user.e2e@example.com');
      await page.getByLabel(/Total Amount/i).fill('3500');

      // Submit the booking
      await page.getByRole('button', { name: /Book Client$/i }).click();

      // Wait for success and modal to close
      await expect(page.locator('text=Quick Book Client for Retreat')).not.toBeVisible();
      await page.waitForTimeout(2000);

      // Verify the client appears in the retreat clients table
      await expect(page.locator('text=Test User')).toBeVisible();
    }
  });

  test('should add existing client to retreat using searchable modal', async ({ page }) => {
    // Navigate to a retreat detail page first
    await page.waitForSelector('table, .grid, .retreat-item');
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();

      // Wait for the page to load and find Add Existing Client button
      await page.waitForSelector('button:has-text("Add Existing Client"), button[class*="add-existing-client-btn"]');

      // Click Add Existing Client button
      await page.getByRole('button', { name: /Add Existing Client/i }).click();

      // Check if searchable client selector modal opens
      await expect(page.locator('text=Add Existing Client to Retreat')).toBeVisible();

      // Check if search input is visible
      const searchInput = page.getByPlaceholder(/Search by name, phone, or display ID/i);
      await expect(searchInput).toBeVisible();

      // Test search functionality
      await searchInput.fill('Test');
      await page.waitForTimeout(1000);

      // Should show filtered results
      const clientItems = page.locator('div').filter({ hasText: 'Test User' });

      if (await clientItems.count() > 0) {
        // Click on the first matching client
        await clientItems.first().click();

        // Modal should close and client should be added
        await expect(page.locator('text=Add Existing Client to Retreat')).not.toBeVisible();
        await page.waitForTimeout(2000);

        // Verify the client appears in the retreat clients table (might be duplicate)
        await expect(page.locator('text=Test User')).toBeVisible();
      } else {
        // If no existing clients, just verify the modal works
        await page.getByRole('button', { name: /Cancel/i }).click();
        await expect(page.locator('text=Add Existing Client to Retreat')).not.toBeVisible();
      }
    }
  });

  test('should search existing clients by display_id', async ({ page }) => {
    // Navigate to a retreat detail page
    await page.waitForSelector('table, .grid, .retreat-item');
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();
      await page.waitForSelector('button:has-text("Add Existing Client")');

      // Open the existing client modal
      await page.getByRole('button', { name: /Add Existing Client/i }).click();
      await expect(page.locator('text=Add Existing Client to Retreat')).toBeVisible();

      const searchInput = page.getByPlaceholder(/Search by name, phone, or display ID/i);

      // Test search by display_id (assuming there are clients with display_id)
      await searchInput.fill('1001');
      await page.waitForTimeout(1000);

      // Should show clients matching the display_id
      const clientList = page.locator('div').filter({ hasText: '#1001' });

      // If clients exist, they should be visible
      if (await clientList.count() > 0) {
        await expect(clientList).toBeVisible();
      }

      // Test search by phone
      await searchInput.fill('1234567890');
      await page.waitForTimeout(1000);

      // Close modal
      await page.getByRole('button', { name: /Cancel/i }).click();
    }
  });

  test('should display retreat metrics and statistics', async ({ page }) => {
    // Navigate to a retreat detail page
    await page.waitForSelector('table, .grid, .retreat-item');
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();

      // Check if metrics section exists
      const metricsPanel = page.locator('text=📊 Financial Metrics');

      if (await metricsPanel.isVisible()) {
        // Expand metrics if collapsed
        await metricsPanel.click();

        // Verify key metrics are displayed
        await expect(page.locator('text=Total Clients')).toBeVisible();
        await expect(page.locator('text=Occupancy Rate')).toBeVisible();
        await expect(page.locator('text=Revenue Collected')).toBeVisible();
        await expect(page.locator('text=Confirmed')).toBeVisible();
      }
    }
  });

  test('should handle retreat tabs navigation', async ({ page }) => {
    // Navigate to a retreat detail page
    await page.waitForSelector('table, .grid, .retreat-item');
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();

      // Check if tab navigation exists
      const clientsTab = page.locator('text=📋 Clients');
      const expensesTab = page.locator('text=💰 Expenses');
      const paymentsTab = page.locator('text=💳 Payments');
      const ceremoniesTab = page.locator('text=🔮 Ceremonies');
      const analyticsTab = page.locator('text=📊 Analytics');

      // Test Clients tab (should be active by default)
      if (await clientsTab.isVisible()) {
        await expect(clientsTab).toBeVisible();
        await expect(page.getByRole('button', { name: /Quick Book Client/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Add Existing Client/i })).toBeVisible();
      }

      // Test Expenses tab
      if (await expensesTab.isVisible()) {
        await expensesTab.click();
        await page.waitForTimeout(500);
        // Expenses content should be visible
        await expect(page.locator('text=Expenses, text=💰')).toBeVisible();
      }

      // Test Payments tab
      if (await paymentsTab.isVisible()) {
        await paymentsTab.click();
        await page.waitForTimeout(500);
        // Payments content should be visible
        await expect(page.locator('text=Payments, text=💳')).toBeVisible();
      }

      // Return to Clients tab
      if (await clientsTab.isVisible()) {
        await clientsTab.click();
        await page.waitForTimeout(500);
        await expect(page.getByRole('button', { name: /Quick Book Client/i })).toBeVisible();
      }
    }
  });

  test('should edit booking details', async ({ page }) => {
    // Navigate to a retreat with clients
    await page.waitForSelector('table, .grid, .retreat-item');
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();

      // Look for edit button in the clients table
      const editButton = page.locator('button[title="Edit Booking"], button').filter({ hasText: /edit/i }).first();

      if (await editButton.count() > 0) {
        await editButton.click();

        // Check if edit modal opens
        await expect(page.locator('text=Edit Booking')).toBeVisible();

        // Verify form fields are present
        await expect(page.getByLabel(/Check-in Date/i)).toBeVisible();
        await expect(page.getByLabel(/Check-out Date/i)).toBeVisible();
        await expect(page.getByLabel(/Status/i)).toBeVisible();
        await expect(page.getByLabel(/Total Amount/i)).toBeVisible();

        // Close modal
        await page.getByRole('button', { name: /Cancel/i }).click();
        await expect(page.locator('text=Edit Booking')).not.toBeVisible();
      }
    }
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    // Check if retreats page adapts to mobile
    await expect(page.locator('h1')).toContainText('Retreats');

    // Navigate to retreat detail if possible
    await page.waitForSelector('table, .grid, .retreat-item');
    const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();

    if (await firstRetreat.count() > 0) {
      await firstRetreat.click();

      // Buttons should be visible and accessible on mobile
      await expect(page.getByRole('button', { name: /Quick Book Client/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Add Existing Client/i })).toBeVisible();

      // Table should be scrollable on mobile
      const table = page.locator('.overflow-x-auto, table');
      if (await table.count() > 0) {
        await expect(table).toBeVisible();
      }
    }
  });
});
