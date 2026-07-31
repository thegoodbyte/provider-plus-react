import { ExpenseType } from '../types';

const CATEGORY_NAME_OVERRIDES: Record<string, string> = {
  'house-cost': 'House',
  'food-shopping': 'Groceries',
};

export const expenseCategoryName = (type?: ExpenseType | null) => {
  if (!type) return 'Uncategorized';
  return CATEGORY_NAME_OVERRIDES[String(type.key || '')] || type.name || 'Uncategorized';
};
