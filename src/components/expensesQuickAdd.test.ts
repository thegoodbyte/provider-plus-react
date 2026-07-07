import { getCurrentRetreatForDate, resolveExpenseTypeIdForCategory } from './expensesQuickAdd';

describe('expensesQuickAdd helpers', () => {
  it('finds the retreat that spans the selected date', () => {
    const retreats = [
      {
        _id: 'retreat-early',
        code: 'EARLY-RETREAT',
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-05T23:59:59.000Z',
      },
      {
        _id: 'retreat-current',
        code: 'CURRENT-RETREAT',
        startDate: '2026-06-10T00:00:00.000Z',
        endDate: '2026-06-20T23:59:59.000Z',
      },
    ] as any;

    expect(getCurrentRetreatForDate(retreats, new Date('2026-06-12T12:00:00.000Z'))?._id).toBe('retreat-current');
    expect(getCurrentRetreatForDate(retreats, new Date('2026-06-08T12:00:00.000Z'))).toBeNull();
  });

  it('prefers the matching active expense type category', () => {
    const expenseTypes = [
      { _id: 'type-transport', category: 'transport', isActive: true },
      { _id: 'type-food', category: 'food', isActive: true },
      { _id: 'type-general', category: 'general', isActive: false },
    ] as any;

    expect(resolveExpenseTypeIdForCategory(expenseTypes, 'food')).toBe('type-food');
    expect(resolveExpenseTypeIdForCategory(expenseTypes, 'general')).toBe('type-transport');
  });
});
