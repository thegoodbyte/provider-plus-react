import { splitRetreatStaffingRetreats } from './RetreatStaffingPage.helpers';

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
});
