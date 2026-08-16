import { activeRetreatClients, isCancelledBookingStatus } from './retreatClientVisibility';

describe('retreat client visibility', () => {
  it('treats cancelled spelling variants case-insensitively', () => {
    expect(isCancelledBookingStatus('cancelled')).toBe(true);
    expect(isCancelledBookingStatus('CANCELED')).toBe(true);
    expect(isCancelledBookingStatus('confirmed')).toBe(false);
  });

  it('excludes cancelled bookings from the active clients list', () => {
    expect(activeRetreatClients([
      { status: 'confirmed' },
      { status: 'cancelled' },
      { status: 'Cancelled' },
      { status: 'canceled' },
    ])).toHaveLength(1);
  });
});
