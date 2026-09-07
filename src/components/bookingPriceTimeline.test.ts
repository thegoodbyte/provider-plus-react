import { buildBookingPriceTimeline, monthKey, monthLabel } from './bookingPriceTimeline';

describe('bookingPriceTimeline', () => {
  describe('monthKey / monthLabel', () => {
    it('derives a sortable YYYY-MM key and a human label from a date', () => {
      const key = monthKey('2026-03-15T10:00:00Z');
      expect(key).toBe('2026-03');
      expect(monthLabel('2026-03')).toBe('Mar 2026');
    });

    it('returns null for a missing or invalid date', () => {
      expect(monthKey(undefined)).toBeNull();
      expect(monthKey('not-a-date')).toBeNull();
    });
  });

  describe('buildBookingPriceTimeline', () => {
    it('groups bookings by registration month and computes average USD price per month', () => {
      const result = buildBookingPriceTimeline([
        { _id: 'a', registrationDate: '2026-01-05', totalAmountUsd: 1000, status: 'confirmed' },
        { _id: 'b', registrationDate: '2026-01-20', totalAmountUsd: 2000, status: 'confirmed' },
        { _id: 'c', registrationDate: '2026-02-10', totalAmountUsd: 1500, status: 'confirmed' },
      ]);

      expect(result.buckets.map(b => b.month)).toEqual(['2026-01', '2026-02']);
      expect(result.buckets[0]).toMatchObject({ count: 2, avgPriceUsd: 1500 });
      expect(result.buckets[1]).toMatchObject({ count: 1, avgPriceUsd: 1500 });
      expect(result.points).toHaveLength(3);
      expect(result.includedCount).toBe(3);
    });

    it('falls back to createdAt when registrationDate is absent', () => {
      const result = buildBookingPriceTimeline([
        { _id: 'a', createdAt: '2026-05-01', totalAmountUsd: 900, status: 'confirmed' },
      ]);
      expect(result.buckets[0].month).toBe('2026-05');
    });

    it('fills gap months between the earliest and latest observed month with zero-count buckets', () => {
      const result = buildBookingPriceTimeline([
        { _id: 'a', registrationDate: '2026-01-01', totalAmountUsd: 1000, status: 'confirmed' },
        { _id: 'b', registrationDate: '2026-04-01', totalAmountUsd: 2000, status: 'confirmed' },
      ]);

      expect(result.buckets.map(b => b.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
      expect(result.buckets[1]).toMatchObject({ count: 0, avgPriceUsd: null });
      expect(result.buckets[2]).toMatchObject({ count: 0, avgPriceUsd: null });
    });

    it('excludes cancelled bookings by default but can include them', () => {
      const bookings = [
        { _id: 'a', registrationDate: '2026-01-01', totalAmountUsd: 1000, status: 'cancelled' },
        { _id: 'b', registrationDate: '2026-01-01', totalAmountUsd: 500, status: 'confirmed' },
      ];

      const excluded = buildBookingPriceTimeline(bookings);
      expect(excluded.buckets[0].count).toBe(1);
      expect(excluded.excludedCancelled).toBe(1);

      const included = buildBookingPriceTimeline(bookings, { includeCancelled: true });
      expect(included.buckets[0].count).toBe(2);
      expect(included.excludedCancelled).toBe(0);
    });

    it('tracks bookings missing a date or a USD-normalized price separately, so the caller can surface pending backfill counts', () => {
      const result = buildBookingPriceTimeline([
        { _id: 'a', totalAmountUsd: 1000, status: 'confirmed' }, // missing date
        { _id: 'b', registrationDate: '2026-01-01', status: 'confirmed' }, // missing usd price
        { _id: 'c', registrationDate: '2026-01-01', totalAmountUsd: 700, status: 'confirmed' },
      ]);

      expect(result.excludedMissingDate).toBe(1);
      expect(result.excludedMissingPrice).toBe(1);
      expect(result.includedCount).toBe(1);
    });

    it('returns empty buckets and points for no bookings', () => {
      const result = buildBookingPriceTimeline([]);
      expect(result.buckets).toEqual([]);
      expect(result.points).toEqual([]);
    });
  });
});
