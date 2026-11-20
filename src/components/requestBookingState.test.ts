import { requestBookingState, requestBookingReferences } from './requestBookingState';
const initial = { _id: 'r', clientId: 'c', retreatId: 't', requestType: 'deposit', status: 'pending' };
it('distinguishes waiting for payment, paid needing a booking, and a linked booking without a display number', () => {
  expect(requestBookingState(initial)).toBe('waiting');
  expect(requestBookingState({ ...initial, status: 'paid' })).toBe('needed');
  for (const bookingId of ['booking', { _id: 'booking' }, { id: 'booking' }]) expect(requestBookingState({ ...initial, bookingId })).toBe('linked');
});
it('recognizes all participant and line links and prefers the display number', () => {
  const request = { ...initial, lineItems: [{ bookingId: 'booking' }], participantBookings: [{ bookingId: { _id: 'booking', bookingNumber: 1337 } }] };
  expect(requestBookingState(request)).toBe('linked');
  expect(requestBookingReferences(request).get('booking').bookingNumber).toBe(1337);
});
it('does not turn service, cancelled, additional or group/balance requests into new single bookings', () => {
  for (const patch of [{ context: 'event' }, { context: 'standalone_service' }, { status: 'cancelled' }, { requestType: 'additional' }]) expect(requestBookingState({ ...initial, ...patch })).toBe('none');
  for (const patch of [{ requestType: 'balance' }, { lineItems: [{ clientId: 'c' }, { clientId: 'other' }] }, { participantBookings: [{}] }]) expect(requestBookingState({ ...initial, status: 'paid', ...patch })).toBe('review');
});
