import { ceremonyBookingDateTimes, retreatBookingDateTimes } from './BookingEditorForm';

describe('ceremonyBookingDateTimes', () => {
  it('sets arrival to the evening before the ceremony and departure to the ceremony date', () => {
    expect(ceremonyBookingDateTimes({ date: '2026-09-19T00:00:00.000Z' }))
      .toEqual({ checkInDate: '2026-09-18T00:00', checkOutDate: '2026-09-19T00:00' });
  });

  it('returns no date updates when the ceremony has no date yet', () => {
    expect(ceremonyBookingDateTimes(undefined)).toEqual({});
    expect(ceremonyBookingDateTimes({ date: undefined as any })).toEqual({});
  });
});

describe('retreatBookingDateTimes', () => {
  it('maps the retreat schedule into booking arrival and departure fields', () => {
    expect(retreatBookingDateTimes({
      name: 'Autumn retreat', location: 'Mýto',
      startDate: '2026-10-10T12:00:00.000Z', startTime: '18:30',
      endDate: '2026-10-17T12:00:00.000Z', endTime: '09:15',
    })).toEqual({ checkInDate: '2026-10-10T18:30', checkOutDate: '2026-10-17T09:15' });
  });

  it('supports legacy retreat schedule fields', () => {
    expect(retreatBookingDateTimes({
      name: 'Legacy retreat', location: 'Mýto',
      dates: { startDate: '2026-11-01', startTime: '17:00', endDate: '2026-11-08', endTime: '10:00' },
    })).toEqual({ checkInDate: '2026-11-01T17:00', checkOutDate: '2026-11-08T10:00' });
  });
});
