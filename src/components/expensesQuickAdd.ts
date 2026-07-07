import { ExpenseType, Retreat } from '../types';

export type ExpenseScope = 'retreat' | 'general';

const getDateValue = (value?: Date | string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getCurrentRetreatForDate = (retreats: Retreat[] = [], currentDate = new Date()) => {
  const now = currentDate.getTime();
  return retreats.find((retreat) => {
    const start = getDateValue(retreat.startDate || retreat.dates?.startDate);
    const end = getDateValue(retreat.endDate || retreat.dates?.endDate);
    if (!start || !end) return false;
    return now >= start.getTime() && now <= end.getTime();
  }) || null;
};

export const resolveExpenseTypeIdForCategory = (expenseTypes: ExpenseType[] = [], category: ExpenseType['category']) => {
  const orderedTypes = expenseTypes.filter((type) => type.isActive !== false);
  const directMatch = orderedTypes.find((type) => type.category === category);
  return directMatch?._id || orderedTypes[0]?._id || '';
};
