import { BookingFlowItem, BookingFlowTemplate } from '../types';

export type RetreatBookingStepOption = {
  key: string;
  label: string;
  order: number;
};

const completedStatuses = new Set([
  'received',
  'reviewed',
  'approved',
  'caution',
  'completed',
  'waived',
]);

export const isBookingStepComplete = (item?: Pick<BookingFlowItem, 'status'> | null) =>
  Boolean(item && completedStatuses.has(String(item.status || '').trim().toLowerCase()));

export const buildBookingStepOptions = (matrices: Array<{ templates?: BookingFlowTemplate[] }>) => {
  const map = new Map<string, RetreatBookingStepOption>();

  matrices.forEach((matrix) => {
    (matrix.templates || []).forEach((template) => {
      if (!template?.key || template.active === false) return;
      const current = map.get(template.key);
      const label = template.title || template.key;
      const order = Number(template.order || 0);
      if (!current || order < current.order || (order === current.order && label.localeCompare(current.label) < 0)) {
        map.set(template.key, {
          key: template.key,
          label,
          order,
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
};

export const getSelectedStepCellTone = (complete: boolean) => ({
  cell: complete ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
  badge: complete ? 'border-green-200 bg-green-100 text-green-800' : 'border-red-200 bg-red-100 text-red-800',
});

export const formatRetreatCalendarDate = (
  value?: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
};

export const retreatMonthGroup = (value?: string | Date) => {
  if (!value) return { key: 'unscheduled', label: 'Unscheduled' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { key: 'unscheduled', label: 'Unscheduled' };
  return {
    key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
    label: formatRetreatCalendarDate(date, { month: 'long', year: 'numeric' }),
  };
};
