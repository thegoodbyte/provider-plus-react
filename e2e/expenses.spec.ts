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
  key: 'food-shopping',
  name: 'Food',
  description: 'Food supplies',
  category: 'food',
  isActive: true,
};
const houseExpenseType = {
  _id: 'expense-type-house',
  key: 'house-cost',
  name: 'House Cost',
  description: 'Accommodation and house costs',
  category: 'general',
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
            expenseKind: 'actual',
          },
          {
            _id: 'expense-other',
            retreatId: otherRetreat,
            expenseTypeId: houseExpenseType,
            amount: 90,
            currency: 'EUR',
            description: 'JNO house deposit',
            vendor: 'Casa Jono',
            expenseDate: '2026-07-27T00:00:00.000Z',
            status: 'planned',
            expenseKind: 'planned',
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
        body: JSON.stringify([foodExpenseType, houseExpenseType]),
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

    await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'BEN retreat supplies' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'JNO house deposit' })).toBeVisible();

    await page.getByLabel('Filter expenses by retreat').selectOption('retreat-ben');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('BEN retreat supplies');
    await expect(rows.first()).toContainText('BEN-06-17-26');
    await expect(page.getByRole('cell', { name: 'JNO house deposit' })).not.toBeVisible();
  });

  test('combines the newest expense filters and uses direct category names', async ({ page }) => {
    await page.goto('/admin/expenses');
    await expect(page.getByRole('cell', { name: 'JNO house deposit' })).toBeVisible();

    await page.getByLabel('Filter expenses by retreat').selectOption('retreat-other');
    await page.getByLabel('Filter expenses by category').selectOption('expense-type-house');
    await page.getByLabel('Filter expenses by status').selectOption('planned');
    await page.getByLabel('Filter planned or actual expenses').selectOption('planned');
    await page.getByLabel('Filter expenses by currency').selectOption('EUR');

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('JNO house deposit');
    await expect(rows.first()).toContainText('House');
    await expect(rows.first()).not.toContainText('House Cost');
    await expect(page.getByText('1 of 2 expenses')).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });
});
