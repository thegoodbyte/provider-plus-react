import { bookingsBelongingToClient } from './medicalArtifactBookingLookup';

describe('bookingsBelongingToClient', () => {
  it('matches both populated and unpopulated booking client references', () => {
    const bookings = [
      { _id: 'booking-1224', clientId: 'client-1053' },
      { _id: 'booking-populated', clientId: { _id: 'client-1053' } },
      { _id: 'booking-1223', clientId: 'client-1056' },
    ] as any;

    expect(bookingsBelongingToClient(bookings, 'client-1053').map((booking) => booking._id))
      .toEqual(['booking-1224', 'booking-populated']);
  });
});
