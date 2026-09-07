import { isCancelledBookingStatus } from './retreatClientVisibility';

export interface BookingTimelineSource {
  _id?: string;
  registrationDate?: string | Date;
  createdAt?: string | Date;
  totalAmountUsd?: number;
  totalAmount?: number;
  currency?: string;
  status?: unknown;
}

export interface MonthlyPriceBucket {
  month: string; // YYYY-MM
  label: string; // e.g. "Jan 2026"
  count: number;
  avgPriceUsd: number | null;
  totalPriceUsd: number;
}

export interface ScatterPoint {
  month: string;
  label: string;
  priceUsd: number;
}

export interface BookingPriceTimeline {
  buckets: MonthlyPriceBucket[];
  points: ScatterPoint[];
  excludedMissingDate: number;
  excludedMissingPrice: number;
  excludedCancelled: number;
  includedCount: number;
}

export const monthKey = (value?: string | Date): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const nextMonthKey = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month, 1)); // month is already 1-indexed input -> rolls forward one month
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Groups bookings by the month they were booked (registrationDate, falling back to
 * createdAt) against their USD-normalized price, filling gaps between the earliest
 * and latest observed month so the timeline reads as continuous even where the
 * business has not yet backfilled older records.
 */
export const buildBookingPriceTimeline = (
  bookings: BookingTimelineSource[],
  options: { includeCancelled?: boolean } = {}
): BookingPriceTimeline => {
  const { includeCancelled = false } = options;
  const byMonth = new Map<string, { count: number; total: number }>();
  const points: ScatterPoint[] = [];
  let excludedMissingDate = 0;
  let excludedMissingPrice = 0;
  let excludedCancelled = 0;

  bookings.forEach((booking) => {
    if (!includeCancelled && isCancelledBookingStatus(booking.status)) {
      excludedCancelled += 1;
      return;
    }
    const key = monthKey(booking.registrationDate || booking.createdAt);
    if (!key) {
      excludedMissingDate += 1;
      return;
    }
    const price = typeof booking.totalAmountUsd === 'number' ? booking.totalAmountUsd : undefined;
    if (price === undefined) {
      excludedMissingPrice += 1;
      return;
    }
    const bucket = byMonth.get(key) || { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += price;
    byMonth.set(key, bucket);
    points.push({ month: key, label: monthLabel(key), priceUsd: price });
  });

  const observedMonths = Array.from(byMonth.keys()).sort();
  const buckets: MonthlyPriceBucket[] = [];
  if (observedMonths.length > 0) {
    let cursor = observedMonths[0];
    const last = observedMonths[observedMonths.length - 1];
    while (cursor <= last) {
      const bucket = byMonth.get(cursor);
      buckets.push({
        month: cursor,
        label: monthLabel(cursor),
        count: bucket?.count || 0,
        avgPriceUsd: bucket ? bucket.total / bucket.count : null,
        totalPriceUsd: bucket?.total || 0,
      });
      cursor = nextMonthKey(cursor);
    }
  }

  return {
    buckets,
    points,
    excludedMissingDate,
    excludedMissingPrice,
    excludedCancelled,
    includedCount: points.length,
  };
};
