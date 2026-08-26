import { retreatBookingDateTimes } from './BookingEditorForm';

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
