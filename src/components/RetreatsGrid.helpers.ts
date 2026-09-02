import { BookingFlowItem, BookingFlowTemplate } from '../types';
import { isSatisfiedStatus } from './bookingStatusSelectors';

export type RetreatBookingStepOption = {
  key: string;
  label: string;
  order: number;
};

export const isBookingStepComplete = (item?: Pick<BookingFlowItem, 'status'> | null) =>
  Boolean(item && isSatisfiedStatus(item.status));

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

export const validateRetreatCreateData = (retreat: {
  name?: string;
  location?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  capacity?: number;
}) => {
  const errors: string[] = [];
  if (!String(retreat.name || '').trim()) errors.push('Retreat name is required.');
  if (!String(retreat.location || '').trim()) errors.push('Location town is required.');
  if (!retreat.startDate) errors.push('Start date is required.');
  if (!retreat.endDate) errors.push('End date is required.');
  if (!Number.isInteger(Number(retreat.capacity)) || Number(retreat.capacity) < 1) errors.push('Capacity must be a positive whole number.');

  if (retreat.startDate && retreat.endDate) {
    const start = new Date(retreat.startDate);
    const end = new Date(retreat.endDate);
    if (Number.isNaN(start.getTime())) errors.push('Start date is invalid.');
    if (Number.isNaN(end.getTime())) errors.push('End date is invalid.');
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start >= end) {
      errors.push('End date must be after the start date.');
    }
  }

  return errors;
};
