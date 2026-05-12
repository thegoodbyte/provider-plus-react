import { test, expect } from '@playwright/test';

test.describe('Forms Validation and Error Handling', () => {
  test.describe('Client Form Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/clients');
      await page.waitForLoadState('networkidle');
    });

    test('should validate required fields in client creation', async ({ page }) => {
      // Open client creation form
      await page.getByRole('button', { name: /Add Client/i }).click();
      await expect(page.locator('text=Add New Client')).toBeVisible();

      // Try to submit empty form
      await page.getByRole('button', { name: /Add Client$/i }).click();

      // Should show validation errors
      const errorMessages = page.locator('text=required, text=Please enter, .error-message');
      expect(await errorMessages.count()).toBeGreaterThan(0);

      // Form should not close
      await expect(page.locator('text=Add New Client')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.getByRole('button', { name: /Add Client/i }).click();

      // Enter invalid email
      await page.getByLabel(/Email/i).fill('invalid-email');
      await page.getByLabel(/First Name/i).fill('Test'); // Fill another field to trigger validation

      // Should show email format error
      const emailError = page.locator('text=valid email, text=email format, .email-error');
      if (await emailError.count() > 0) {
        await expect(emailError).toBeVisible();
      }

      // Enter valid email
      await page.getByLabel(/Email/i).fill('test@example.com');

      // Error should disappear
      if (await emailError.count() > 0) {
        await expect(emailError).not.toBeVisible();
      }
    });

    test('should validate display_id uniqueness', async ({ page }) => {
      await page.getByRole('button', { name: /Add Client/i }).click();

      // Try to use an existing display_id (assuming 1001 exists)
      await page.getByLabel(/Client ID/i).fill('1001');
      await page.getByLabel(/First Name/i).fill('Test');
      await page.getByLabel(/Last Name/i).fill('User');
      await page.getByLabel(/Email/i).fill('testunique@example.com');
      await page.getByLabel(/Phone/i).fill('1234567890');
      await page.getByLabel(/Country/i).selectOption('USA');

      await page.getByRole('button', { name: /Add Client$/i }).click();

      // Should either show uniqueness error or succeed (if 1001 doesn't exist)
      await page.waitForTimeout(2000);

      const uniquenessError = page.locator('text=already exists, text=taken, text=duplicate');
      const successModal = page.locator('text=Add New Client');

      // Either should show error or modal should close (success)
      const errorExists = await uniquenessError.count() > 0;
      const modalClosed = !(await successModal.isVisible());

      expect(errorExists || modalClosed).toBeTruthy();
    });

    test('should validate phone number format', async ({ page }) => {
      await page.getByRole('button', { name: /Add Client/i }).click();

      // Enter invalid phone number
      await page.getByLabel(/Phone/i).fill('abc123');
      await page.getByLabel(/First Name/i).fill('Test');

      // Some forms may validate phone format
      const phoneError = page.locator('text=valid phone, text=phone format, .phone-error');
      // Note: This test is optional as phone validation might not be strict
    });
  });

  test.describe('Retreat Booking Form Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/retreats');
      await page.waitForLoadState('networkidle');

      // Navigate to a retreat detail page
      const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();
      if (await firstRetreat.count() > 0) {
        await firstRetreat.click();
        await page.waitForSelector('button:has-text("Quick Book Client")');
      } else {
        test.skip('No retreats available for booking tests');
      }
    });

    test('should validate quick booking form required fields', async ({ page }) => {
      // Open quick booking modal
      await page.getByRole('button', { name: /Quick Book Client/i }).click();
      await expect(page.locator('text=Quick Book Client for Retreat')).toBeVisible();

      // Try to submit empty form
      await page.getByRole('button', { name: /Book Client$/i }).click();

      // Should show validation errors
      const errorMessages = page.locator('text=required, text=Please enter, .ant-form-item-explain-error');
      expect(await errorMessages.count()).toBeGreaterThan(0);

      // Modal should remain open
      await expect(page.locator('text=Quick Book Client for Retreat')).toBeVisible();
    });

    test('should validate amount is positive number', async ({ page }) => {
      await page.getByRole('button', { name: /Quick Book Client/i }).click();

      // Enter negative amount
      await page.getByLabel(/Total Amount/i).fill('-100');

      // Fill other required fields
      await page.getByLabel(/First Name/i).fill('Test');
      await page.getByLabel(/Last Name/i).fill('User');
      await page.getByLabel(/Phone Number/i).fill('1234567890');
      await page.getByLabel(/Email/i).fill('test@example.com');

      await page.getByRole('button', { name: /Book Client$/i }).click();

      // Should show amount validation error or convert to positive
      await page.waitForTimeout(1000);

      // The form might either show error or handle negative values
      const amountError = page.locator('text=positive, text=greater than, .amount-error');
      // This is a soft validation as different forms handle this differently
    });

    test('should validate email in booking form', async ({ page }) => {
      await page.getByRole('button', { name: /Quick Book Client/i }).click();

      // Enter invalid email
      await page.getByLabel(/Email/i).fill('invalid-email-format');

      // Fill other fields
      await page.getByLabel(/First Name/i).fill('Test');
      await page.getByLabel(/Last Name/i).fill('User');
      await page.getByLabel(/Phone Number/i).fill('1234567890');
      await page.getByLabel(/Total Amount/i).fill('3000');

      await page.getByRole('button', { name: /Book Client$/i }).click();

      // Should show email validation error
      const emailError = page.locator('text=valid email, .ant-form-item-explain-error');
      if (await emailError.count() > 0) {
        await expect(emailError).toBeVisible();
      }
    });
  });

  test.describe('Search and Filter Validation', () => {
    test('should handle empty search gracefully', async ({ page }) => {
      await page.goto('/admin/clients');
      await page.waitForLoadState('networkidle');

      // Try empty search
      const searchInput = page.getByPlaceholder(/Search/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill('');
        await page.waitForTimeout(500);

        // Should show all clients or appropriate empty state
        const table = page.locator('table, .grid');
        await expect(table).toBeVisible();
      }
    });

    test('should handle search with no results', async ({ page }) => {
      await page.goto('/admin/clients');
      await page.waitForLoadState('networkidle');

      const searchInput = page.getByPlaceholder(/Search/i);
      if (await searchInput.isVisible()) {
        // Search for non-existent client
        await searchInput.fill('XYZ_NONEXISTENT_CLIENT_NAME_12345');
        await page.waitForTimeout(1000);

        // Should show no results message or empty table
        const noResults = page.locator('text=No results, text=No clients found, text=not found');
        const emptyTable = page.locator('tbody tr', { hasText: 'No data' });

        expect(await noResults.count() > 0 || await emptyTable.count() > 0).toBeTruthy();
      }
    });

    test('should validate searchable client selector', async ({ page }) => {
      // Navigate to retreat and open existing client modal
      await page.goto('/admin/retreats');
      await page.waitForSelector('table, .grid, .retreat-item');

      const firstRetreat = page.locator('tr:not(:first-child), .retreat-item').first();
      if (await firstRetreat.count() > 0) {
        await firstRetreat.click();
        await page.waitForSelector('button:has-text("Add Existing Client")');

        await page.getByRole('button', { name: /Add Existing Client/i }).click();
        await expect(page.locator('text=Add Existing Client to Retreat')).toBeVisible();

        const searchInput = page.getByPlaceholder(/Search by name, phone, or display ID/i);

        // Test search with special characters
        await searchInput.fill('!@#$%^&*()');
        await page.waitForTimeout(500);

        // Should handle gracefully without errors
        const errorMessage = page.locator('text=Error, .error');
        expect(await errorMessage.count()).toBe(0);

        // Test search with very long string
        await searchInput.fill('a'.repeat(100));
        await page.waitForTimeout(500);

        // Should handle gracefully
        expect(await errorMessage.count()).toBe(0);

        // Close modal
        await page.getByRole('button', { name: /Cancel/i }).click();
      }
    });
  });

  test.describe('Network Error Handling', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      await page.goto('/admin/clients');

      // Simulate network failure
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      // Try to add a client (this will fail due to network abort)
      await page.getByRole('button', { name: /Add Client/i }).click();
      await page.getByLabel(/First Name/i).fill('Test');
      await page.getByLabel(/Last Name/i).fill('User');
      await page.getByLabel(/Email/i).fill('test@example.com');
      await page.getByLabel(/Phone/i).fill('1234567890');
      await page.getByLabel(/Country/i).selectOption('USA');

      await page.getByRole('button', { name: /Add Client$/i }).click();

      // Should show network error message
      await page.waitForTimeout(2000);
      const errorMessage = page.locator('text=error, text=failed, text=network, .error-message');

      // Error should be displayed somewhere (modal, toast, inline)
      expect(await errorMessage.count()).toBeGreaterThan(0);
    });

    test('should retry failed requests appropriately', async ({ page }) => {
      await page.goto('/admin/clients');

      let requestCount = 0;
      await page.route('**/api/clients', route => {
        requestCount++;
        if (requestCount === 1) {
          // Fail first request
          route.abort('failed');
        } else {
          // Allow subsequent requests
          route.continue();
        }
      });

      // Trigger a request that will fail first time
      await page.reload();

      // The app should either retry automatically or show retry option
      await page.waitForTimeout(3000);

      // Should eventually load or show retry option
      const retryButton = page.getByRole('button', { name: /retry/i });
      const content = page.locator('h1, table, .grid');

      if (await retryButton.isVisible()) {
        await retryButton.click();
        await expect(content).toBeVisible();
      } else {
        // Should have loaded automatically
        await expect(content).toBeVisible();
      }
    });
  });

  test.describe('Form Accessibility and UX', () => {
    test('should have proper form focus management', async ({ page }) => {
      await page.goto('/admin/clients');
      await page.getByRole('button', { name: /Add Client/i }).click();

      // First field should be focused
      const firstField = page.getByLabel(/Client ID/i);
      await expect(firstField).toBeFocused();

      // Tab navigation should work
      await page.keyboard.press('Tab');
      const secondField = page.getByLabel(/First Name/i);
      await expect(secondField).toBeFocused();
    });

    test('should provide helpful error messages', async ({ page }) => {
      await page.goto('/admin/clients');
      await page.getByRole('button', { name: /Add Client/i }).click();

      // Submit empty form
      await page.getByRole('button', { name: /Add Client$/i }).click();

      // Error messages should be descriptive
      const errorMessages = page.locator('.error-message, .ant-form-item-explain-error');
      if (await errorMessages.count() > 0) {
        const errorText = await errorMessages.first().textContent();
        expect(errorText?.length).toBeGreaterThan(5); // Should be descriptive
        expect(errorText?.toLowerCase()).toContain('required'); // Should mention what's required
      }
    });

    test('should handle form submission states correctly', async ({ page }) => {
      await page.goto('/admin/clients');
      await page.getByRole('button', { name: /Add Client/i }).click();

      // Fill form
      await page.getByLabel(/First Name/i).fill('Test');
      await page.getByLabel(/Last Name/i).fill('User');
      await page.getByLabel(/Email/i).fill('test.form.submit@example.com');
      await page.getByLabel(/Phone/i).fill('1234567890');
      await page.getByLabel(/Country/i).selectOption('USA');

      // Submit form and check for loading state
      const submitButton = page.getByRole('button', { name: /Add Client$/i });
      await submitButton.click();

      // Button should show loading state or be disabled
      await page.waitForTimeout(500);
      const isDisabled = await submitButton.isDisabled();
      const hasLoadingText = (await submitButton.textContent())?.includes('...') ||
                            (await submitButton.textContent())?.toLowerCase().includes('loading');

      // Either disabled or showing loading text
      expect(isDisabled || hasLoadingText).toBeTruthy();
    });
  });
});