import { expenseCategoryName } from './expenseCategory';

describe('expenseCategoryName', () => {
  it.each([
    [{ key: 'house-cost', name: 'House Cost' }, 'House'],
    [{ key: 'food-shopping', name: 'Food' }, 'Groceries'],
    [{ key: 'medical-advisor', name: 'Medical advisor' }, 'Medical advisor'],
  ])('returns the direct business category for %o', (type, expected) => {
    expect(expenseCategoryName(type as any)).toBe(expected);
  });

  it('uses an explicit fallback for missing types', () => {
    expect(expenseCategoryName()).toBe('Uncategorized');
  });
});
