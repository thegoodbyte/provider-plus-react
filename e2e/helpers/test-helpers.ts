import { Page, Locator, expect } from '@playwright/test';

export class TestHelpers {
  constructor(public readonly page: Page) {}

  /**
   * Wait for a page to load completely with network idle
   */
  async waitForPageLoad(timeout = 10000) {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Navigate to admin section with error handling
   */
  async navigateToAdmin(section?: string) {
    const basePath = '/admin';
    const fullPath = section ? `${basePath}/${section}` : basePath;

    await this.page.goto(fullPath);
    await this.waitForPageLoad();

    // Check if we're on login page and handle accordingly
    if (this.page.url().includes('/login')) {
      throw new Error('Authentication required - tests need to handle login');
    }
  }

  /**
   * Fill form field with validation
   */
  async fillField(labelText: string, value: string, options?: { exact?: boolean }) {
    const field = this.page.getByLabel(labelText, options);
    await expect(field).toBeVisible();
    await field.fill(value);
    return field;
  }

  /**
   * Select option from dropdown
   */
  async selectOption(labelText: string, option: string | { index?: number; value?: string; label?: string }) {
    const select = this.page.getByLabel(labelText);
    await expect(select).toBeVisible();

    if (typeof option === 'string') {
      await select.selectOption(option);
    } else if (option.index !== undefined) {
      await select.selectOption({ index: option.index });
    } else if (option.value) {
      await select.selectOption({ value: option.value });
    } else if (option.label) {
      await select.selectOption({ label: option.label });
    }

    return select;
  }

  /**
   * Click button and wait for response
   */
  async clickAndWait(buttonText: string, options?: {
    waitFor?: 'navigation' | 'response' | 'networkidle';
    timeout?: number;
  }) {
    const button = this.page.getByRole('button', { name: new RegExp(buttonText, 'i') });
    await expect(button).toBeVisible();

    if (options?.waitFor === 'navigation') {
      await Promise.all([
        this.page.waitForNavigation(),
        button.click()
      ]);
    } else if (options?.waitFor === 'response') {
      await Promise.all([
        this.page.waitForResponse(response => response.status() < 400),
        button.click()
      ]);
    } else {
      await button.click();
      if (options?.waitFor === 'networkidle') {
        await this.page.waitForLoadState('networkidle');
      }
    }

    return button;
  }

  /**
   * Wait for modal to appear
   */
  async waitForModal(titleText: string, timeout = 5000) {
    const modal = this.page.locator(`text=${titleText}`);
    await expect(modal).toBeVisible({ timeout });
    return modal;
  }

  /**
   * Close modal by clicking cancel or backdrop
   */
  async closeModal(method: 'cancel' | 'backdrop' | 'escape' = 'cancel') {
    switch (method) {
      case 'cancel':
        const cancelButton = this.page.getByRole('button', { name: /cancel/i });
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        }
        break;
      case 'backdrop':
        await this.page.locator('.modal-overlay, .ant-modal-wrap').click();
        break;
      case 'escape':
        await this.page.keyboard.press('Escape');
        break;
    }
  }

  /**
   * Search in table or list
   */
  async searchAndWait(searchTerm: string, options?: { waitTime?: number; placeholder?: string }) {
    const placeholder = options?.placeholder || /search/i;
    const searchInput = this.page.getByPlaceholder(placeholder);

    if (await searchInput.isVisible()) {
      await searchInput.fill(searchTerm);
      await this.page.waitForTimeout(options?.waitTime || 1000);
      return searchInput;
    }
    return null;
  }

  /**
   * Get table rows (excluding header)
   */
  async getTableRows() {
    const table = this.page.locator('table');
    await expect(table).toBeVisible();
    return table.locator('tbody tr');
  }

  /**
   * Find table row by content
   */
  async findTableRowByContent(content: string) {
    const rows = await this.getTableRows();
    return rows.filter({ hasText: content });
  }

  /**
   * Check if element exists without throwing
   */
  async elementExists(selector: string | Locator): Promise<boolean> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    return await locator.count() > 0;
  }

  /**
   * Wait for success message or notification
   */
  async waitForSuccess(message?: string, timeout = 5000) {
    const successSelectors = [
      'text=success',
      'text=Success',
      'text=created',
      'text=saved',
      'text=updated',
      '.success-message',
      '.ant-message-success',
      '.toast-success'
    ];

    if (message) {
      successSelectors.unshift(`text=${message}`);
    }

    for (const selector of successSelectors) {
      try {
        await expect(this.page.locator(selector)).toBeVisible({ timeout: timeout / successSelectors.length });
        return;
      } catch {
        // Try next selector
      }
    }
  }

  /**
   * Wait for error message
   */
  async waitForError(timeout = 5000) {
    const errorSelectors = [
      'text=error',
      'text=Error',
      'text=failed',
      'text=Failed',
      '.error-message',
      '.ant-message-error',
      '.toast-error'
    ];

    for (const selector of errorSelectors) {
      try {
        const element = this.page.locator(selector);
        await expect(element).toBeVisible({ timeout: timeout / errorSelectors.length });
        return element;
      } catch {
        // Try next selector
      }
    }
    return null;
  }

  /**
   * Set viewport for responsive testing
   */
  async setViewport(device: 'mobile' | 'tablet' | 'desktop') {
    const viewports = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1024, height: 768 }
    };

    await this.page.setViewportSize(viewports[device]);
  }

  /**
   * Create a client for testing
   */
  async createTestClient(clientData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country?: string;
    displayId?: string;
  }) {
    await this.navigateToAdmin('clients');
    await this.clickAndWait('Add Client');
    await this.waitForModal('Add New Client');

    if (clientData.displayId) {
      await this.fillField('Client ID', clientData.displayId);
    }

    await this.fillField('First Name', clientData.firstName);
    await this.fillField('Last Name', clientData.lastName);
    await this.fillField('Email', clientData.email);
    await this.fillField('Phone', clientData.phone);

    if (clientData.country) {
      await this.selectOption('Country', clientData.country);
    }

    await this.clickAndWait('Add Client', { waitFor: 'networkidle' });
    await this.page.waitForTimeout(2000);

    return clientData;
  }

  /**
   * Delete test data by searching for it
   */
  async cleanupTestClient(email: string) {
    try {
      await this.navigateToAdmin('clients');
      const searchResult = await this.searchAndWait(email);

      if (searchResult) {
        const clientRow = await this.findTableRowByContent(email);
        if (await clientRow.count() > 0) {
          const deleteButton = clientRow.locator('button[title*="Delete"], button').filter({ hasText: /delete/i });
          if (await deleteButton.count() > 0) {
            // Handle confirmation dialog
            this.page.on('dialog', dialog => dialog.accept());
            await deleteButton.click();
            await this.page.waitForTimeout(1000);
          }
        }
      }
    } catch (error) {
      // Cleanup failed, but don't fail the test
      console.log(`Cleanup failed for ${email}:`, error);
    }
  }

  /**
   * Check responsive design elements
   */
  async checkResponsiveElements() {
    // Check for responsive classes or mobile menu
    const responsiveElements = [
      '.mobile-menu',
      '.hamburger',
      '.menu-toggle',
      '.responsive-table',
      '.overflow-x-auto'
    ];

    const viewport = await this.page.viewportSize();
    const isMobile = viewport && viewport.width < 768;

    for (const selector of responsiveElements) {
      const element = this.page.locator(selector);
      if (await element.count() > 0) {
        if (isMobile) {
          await expect(element).toBeVisible();
        } else {
          // Desktop might hide mobile elements
          // This is optional check
        }
      }
    }
  }

  /**
   * Take screenshot for debugging
   */
  async takeDebugScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `e2e/screenshots/debug-${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Check for console errors
   */
  async checkConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    this.page.on('pageerror', error => {
      errors.push(error.message);
    });

    return errors;
  }
}

// Export utility functions
export const createTestData = {
  client: (overrides?: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    displayId: string;
  }>) => ({
    firstName: 'Test',
    lastName: 'User',
    email: `test.${Date.now()}@example.com`,
    phone: '1234567890',
    country: 'USA',
    ...overrides
  }),

  retreat: (overrides?: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    capacity: number;
  }>) => ({
    name: `Test Retreat ${Date.now()}`,
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next week
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Two weeks
    capacity: 10,
    ...overrides
  })
};

export const selectors = {
  buttons: {
    addClient: 'button:has-text("Add Client")',
    addRetreat: 'button:has-text("Add Retreat")',
    quickBook: 'button:has-text("Quick Book Client")',
    addExistingClient: 'button:has-text("Add Existing Client")',
    save: 'button:has-text("Save"), button:has-text("Add"), button:has-text("Create")',
    cancel: 'button:has-text("Cancel")',
    edit: 'button[title*="Edit"], button:has-text("Edit")',
    delete: 'button[title*="Delete"], button:has-text("Delete")',
    back: 'button:has-text("Back")'
  },

  modals: {
    addClient: 'text=Add New Client',
    editClient: 'text=Edit Client',
    quickBook: 'text=Quick Book Client for Retreat',
    addExistingClient: 'text=Add Existing Client to Retreat'
  },

  tables: {
    clientsTable: 'table, .clients-grid',
    retreatsTable: 'table, .retreats-grid',
    paymentsTable: 'table, .payments-grid'
  }
};