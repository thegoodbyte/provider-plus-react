import { clientPaymentCreatePath, clientPaymentEditPath } from './clientPaymentNavigation';

describe('client payment navigation', () => {
  it('preselects the only booking when creating a payment', () => {
    expect(clientPaymentCreatePath('client-1', [{ _id: 'booking-1196' }]))
      .toBe('/admin/payments/new?clientId=client-1&bookingId=booking-1196');
  });

  it('requires selection in the shared editor when a client has multiple bookings', () => {
    expect(clientPaymentCreatePath('client-1', [{ _id: 'one' }, { _id: 'two' }]))
      .toBe('/admin/payments/new?clientId=client-1');
  });

  it('builds the canonical edit route', () => {
    expect(clientPaymentEditPath('payment/unsafe')).toBe('/admin/payments/payment%2Funsafe/edit');
  });
});
