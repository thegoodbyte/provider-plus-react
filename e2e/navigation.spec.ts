import { test, expect } from '@playwright/test';

test.skip(process.env.PLAYWRIGHT_LIVE !== '1', 'Requires a seeded live API and authorized test credentials');

test.describe('Navigation and Core App Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to admin dashboard', async ({ page }) => {
    // Check if we're redirected to a login page or directly to admin
    const url = page.url();

    if (url.includes('/login')) {
      // Handle login if needed
      // For now, we'll skip actual authentication
      test.skip('Authentication required - skipping navigation test');
    } else if (url.includes('/admin')) {
      // We're already in admin
      await expect(page.locator('h1').or(page.getByText(/Dashboard|Admin/)).first()).toBeVisible();
    } else {
      // Try to navigate to admin
      await page.goto('/admin');
      await expect(page.locator('h1').or(page.getByText(/Dashboard|Admin/)).first()).toBeVisible();
    }
  });

  test('should have working navigation between main sections', async ({ page }) => {
    // Navigate to admin if not already there
    await page.goto('/admin');

    // Test navigation to Clients section
    const clientsLink = page.locator('a[href*="/admin/clients"]').or(page.getByText('Clients', { exact: true })).first();
    if (await clientsLink.isVisible()) {
      await clientsLink.click();
      await expect(page.locator('h1')).toContainText('Client');
      await expect(page.url()).toContain('/admin/clients');
    }

    // Test navigation to Retreats section
    const retreatsLink = page.locator('a[href*="/admin/retreats"]').or(page.getByText('Retreats', { exact: true })).first();
    if (await retreatsLink.isVisible()) {
      await retreatsLink.click();
      await expect(page.locator('h1')).toContainText('Retreat');
      await expect(page.url()).toContain('/admin/retreats');
    }

    // Test navigation to Payments section
    const paymentsLink = page.locator('a[href*="/payments"]').or(page.getByText('Payments', { exact: true })).first();
    if (await paymentsLink.isVisible()) {
      await paymentsLink.click();
      await expect(page.locator('h1')).toContainText('Payment');
      await expect(page.url()).toContain('/payments');
    }

    // Test navigation to Bookings section
    const bookingsLink = page.locator('a[href*="/bookings"]').or(page.getByText('Bookings', { exact: true })).first();
    if (await bookingsLink.isVisible()) {
      await bookingsLink.click();
      await expect(page.locator('h1')).toContainText('Booking');
      await expect(page.url()).toContain('/bookings');
    }
  });

  test('should have responsive navigation menu', async ({ page }) => {
    await page.goto('/admin');

    // Test desktop navigation
    await page.setViewportSize({ width: 1024, height: 768 });
    const desktopNav = page.locator('nav, .navigation, .sidebar');
    if (await desktopNav.count() > 0) {
      await expect(desktopNav).toBeVisible();
    }

    // Test mobile navigation
    await page.setViewportSize({ width: 375, height: 667 });

    // Look for mobile menu button
    const mobileMenuButton = page.locator('button').filter({ hasText: /menu/i }).or(
      page.locator('button[aria-label*="menu"], .hamburger, .menu-toggle')
    );

    if (await mobileMenuButton.count() > 0) {
      await mobileMenuButton.click();

      // Navigation should be visible after clicking
      const mobileNav = page.locator('.mobile-menu, .sidebar, nav[aria-expanded="true"]');
      if (await mobileNav.count() > 0) {
        await expect(mobileNav).toBeVisible();
      }
    }
  });

  test('should handle back navigation correctly', async ({ page }) => {
    await page.goto('/admin/clients');

    // If we have client detail views
    const firstClient = page.locator('tr:not(:first-child), .client-item').first();
    if (await firstClient.count() > 0) {
      await firstClient.click();

      // Should be in client detail view
      await expect(page.locator('text=Client Details, text=Back')).toBeVisible();

      // Test back navigation
      const backButton = page.getByRole('button', { name: /Back/i });
      if (await backButton.isVisible()) {
        await backButton.click();
        await expect(page.url()).toContain('/admin/clients');
        await expect(page.locator('h1')).toContainText('Client');
      }
    }

    // Test browser back button
    await page.goto('/admin/retreats');
    await page.goBack();
    await expect(page.url()).toContain('/admin/clients');
  });

  test('should display loading states appropriately', async ({ page }) => {
    // Test loading on initial page load
    await page.goto('/admin/clients');

    // Look for loading indicators
    const loadingIndicator = page.locator('.loading, .spinner, text=Loading');

    // Loading indicator might appear briefly
    if (await loadingIndicator.count() > 0) {
      // Wait for loading to complete
      await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
    }

    // Content should be loaded
    await expect(page.locator('h1, table, .grid')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto('/admin/nonexistent-page');

    // Should show some kind of error or redirect
    const errorMessage = page.locator('text=404, text=Not Found, text=Error');
    const redirected = page.url().includes('/admin') && !page.url().includes('nonexistent');

    // Either show error or redirect to valid page
    expect(await errorMessage.count() > 0 || redirected).toBeTruthy();
  });

  test('should maintain URL state and allow direct navigation', async ({ page }) => {
    // Test direct navigation to specific pages
    await page.goto('/admin/clients');
    await expect(page.locator('h1')).toContainText('Client');

    await page.goto('/admin/retreats');
    await expect(page.locator('h1')).toContainText('Retreat');

    await page.goto('/payments');
    await expect(page.locator('h1')).toContainText('Payment');

    // Test that page state is maintained on refresh
    await page.goto('/admin/clients');
    await page.reload();
    await expect(page.locator('h1')).toContainText('Client');
    await expect(page.url()).toContain('/admin/clients');
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/admin');

    // Test keyboard navigation
    await page.keyboard.press('Tab');

    // Check for proper ARIA labels and roles
    const navigationElements = page.locator('nav, [role="navigation"]');
    if (await navigationElements.count() > 0) {
      await expect(navigationElements).toBeVisible();
    }

    // Check for proper heading structure
    const mainHeading = page.locator('h1').first();
    if (await mainHeading.count() > 0) {
      await expect(mainHeading).toBeVisible();
    }

    // Test skip links if present
    const skipLink = page.locator('a[href*="#main"], text=Skip to main content');
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeVisible();
    }
  });

  test('should handle concurrent navigation actions', async ({ page }) => {
    await page.goto('/admin');

    // Test rapid navigation clicks
    const clientsLink = page.locator('a[href*="/admin/clients"], text=Clients').first();
    const retreatsLink = page.locator('a[href*="/admin/retreats"], text=Retreats').first();

    if (await clientsLink.isVisible() && await retreatsLink.isVisible()) {
      // Click clients, then quickly click retreats
      await Promise.all([
        clientsLink.click(),
        retreatsLink.click()
      ]);

      // Should end up on one of the pages
      await page.waitForTimeout(1000);
      const finalUrl = page.url();
      expect(finalUrl.includes('/admin/clients') || finalUrl.includes('/admin/retreats')).toBeTruthy();
    }
  });
});
