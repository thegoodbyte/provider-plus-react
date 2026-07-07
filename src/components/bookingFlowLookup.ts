import { BookingFlowItem } from '../types';

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const uniqueCsv = (values: string[]) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).join(',');

export const buildBookingFlowArtifactFilters = (items: BookingFlowItem[] = []) => {
  const bookingFlowItemIds = uniqueCsv(items.map((item) => getObjectId(item._id)));
  const bookingFlowItemKeys = uniqueCsv(items.map((item) => String(item.key || '').trim()));

  return {
    bookingFlowItemId: bookingFlowItemIds || undefined,
    bookingFlowItemKey: bookingFlowItemKeys || undefined,
  };
};
