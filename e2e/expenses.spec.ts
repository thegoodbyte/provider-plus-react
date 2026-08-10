import { test, expect } from '@playwright/test';

const benRetreat = {
  _id: 'retreat-ben',
  name: 'June retreat',
  code: 'BEN-06-17-26',
  retreatCode: 'BEN-06-17-26',
  location: 'Default Location',
  startDate: '2026-06-17T00:00:00.000Z',
  endDate: '2026-06-24T00:00:00.000Z',
};

const otherRetreat = {
  _id: 'retreat-other',
  name: 'July retreat',
  code: 'JNO-07-25-26',
  retreatCode: 'JNO-07-25-26',
  location: 'Default Location',
  startDate: '2026-07-25T00:00:00.000Z',
  endDate: '2026-08-01T00:00:00.000Z',
};

const foodExpenseType = {
  _id: 'expense-type-food',
  name: 'Food',
  description: 'Food supplies',
  category: 'food',
  isActive: true,
};

test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'test-token');
      window.localStorage.setItem('user', JSON.stringify({
        email: 'admin@example.com',
        role: 'admin',
      }));
    });

    await page.route('**/retreat-expenses', async (route) => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            _id: 'expense-ben',
            retreatId: benRetreat,
            expenseTypeId: foodExpenseType,
            amount: 125,
            currency: 'USD',
            description: 'BEN retreat supplies',
            vendor: 'Market',
            expenseDate: '2026-06-20T00:00:00.000Z',
            status: 'paid',
          },
          {
            _id: 'expense-other',
            retreatId: otherRetreat,
            expenseTypeId: foodExpenseType,
            amount: 90,
            currency: 'USD',
            description: 'JNO retreat supplies',
            vendor: 'Market',
            expenseDate: '2026-07-27T00:00:00.000Z',
            status: 'paid',
          },
        ]),
      });
    });

    await page.route('**/expense-types', async (route) => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([foodExpenseType]),
      });
    });

    await page.route('**/retreats', async (route) => {
      if (!['xhr', 'fetch'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([benRetreat, otherRetreat]),
      });
    });
  });

  test('filters populated retreat expenses by retreat code', async ({ page }) => {
    await page.goto('/admin/expenses');

    await expect(page.getByRole('heading', { name: 'Expense Management' })).toBeVisible();
    await expect(page.getByText('BEN retreat supplies')).toBeVisible();
    await expect(page.getByText('JNO retreat supplies')).toBeVisible();

    await page.locator('select').nth(1).selectOption('retreat-ben');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('BEN retreat supplies');
    await expect(rows.first()).toContainText('BEN-06-17-26');
    await expect(page.getByText('JNO retreat supplies')).not.toBeVisible();
  });
});
