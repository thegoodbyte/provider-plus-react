import { formatRetreatStaffingDates, formatStaffAssignmentDates, formatStaffingDate, splitRetreatStaffingRetreats } from './RetreatStaffingPage.helpers';

describe('RetreatStaffingPage helpers', () => {
  it('orders current and past retreats ascending and keeps past retreats separate', () => {
    const now = new Date('2026-09-20T12:00:00Z').getTime();
    const retreats: any[] = [
      { _id: 'past-late', startDate: '2026-08-20', endDate: '2026-08-27' },
      { _id: 'upcoming-late', startDate: '2026-11-20', endDate: '2026-11-27' },
      { _id: 'past-early', startDate: '2026-07-20', endDate: '2026-07-27' },
      { _id: 'current', startDate: '2026-09-18', endDate: '2026-09-22' },
      { _id: 'upcoming-early', startDate: '2026-10-20', endDate: '2026-10-27' },
    ];

    const result = splitRetreatStaffingRetreats(retreats, now);

    expect(result.currentAndUpcoming.map(retreat => retreat._id)).toEqual(['current', 'upcoming-early', 'upcoming-late']);
    expect(result.past.map(retreat => retreat._id)).toEqual(['past-early', 'past-late']);
  });

  it('formats retreat and staff dates with weekdays, times, and retreat fallbacks', () => {
    const retreat: any = { startDate: '2026-09-22T00:00:00Z', startTime: '18:00', endDate: '2026-09-29T00:00:00Z', endTime: '10:00' };
    expect(formatRetreatStaffingDates(retreat)).toBe('Tue, 22/09/2026 – Tue, 29/09/2026');
    expect(formatStaffAssignmentDates({}, retreat)).toBe('Tue, 22/09/2026 · 18:00 → Tue, 29/09/2026 · 10:00');
    expect(formatStaffingDate('2026-09-22T00:00:00Z', 'pl')).toBe('wt., 22/09/2026');
    expect(formatStaffingDate('2026-09-22T00:00:00Z', 'cs')).toBe('út, 22/09/2026');
  });
});
