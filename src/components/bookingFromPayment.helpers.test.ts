import { buildBookingCreateUrlFromPayment } from './bookingFromPayment.helpers';

describe('buildBookingCreateUrlFromPayment', () => {
  it('builds a booking editor url with payment-derived defaults', () => {
    const url = buildBookingCreateUrlFromPayment({
      payment: {
        _id: 'pay-123',
        clientId: 'client-1',
        retreatId: 'retreat-1',
        amount: 850,
        currency: 'USD',
        bookingCurrency: 'PLN',
        bookingCurrencyAmount: 3300,
        status: 'completed',
        paymentMethod: 'bank_transfer',
        paymentType: 'deposit_refundable',
        paymentDate: '2026-07-12T10:00:00.000Z',
        isDeposit: true,
        isFinalPayment: false,
        isRefundable: true,
      } as any,
      paymentRequest: {
        _id: 'req-22',
        currency: 'USD',
        fullPriceQuote: 3300,
      } as any,
    });

    expect(url).toContain('/admin/bookings/new?');
    expect(url).toContain('clientId=client-1');
    expect(url).toContain('retreatId=retreat-1');
    expect(url).toContain('paymentRequestId=req-22');
    expect(url).toContain('paymentId=pay-123');
    expect(url).toContain('currency=PLN');
    expect(url).toContain('totalAmount=3300');
    expect(url).toContain('amountPaid=3300');
    expect(url).toContain('status=confirmed');
  });

  it('keeps a joint receipt allocation separate from the individual agreed booking price', () => {
    const url = buildBookingCreateUrlFromPayment({
      payment: { _id: 'allocation-1', clientId: 'anna', retreatId: 'retreat-1', amount: 3420, currency: 'PLN', status: 'completed' } as any,
      paymentRequest: {
        _id: 'request-1', currency: 'PLN', fullPriceQuote: 17100,
        lineItems: [
          { type: 'charge', description: 'Anna stay', clientId: 'anna', amount: 9000 },
          { type: 'discount', description: 'Joint booking discount', clientId: 'anna', amount: -450 },
          { type: 'charge', description: 'Jan stay', clientId: 'jan', amount: 9000 },
          { type: 'discount', description: 'Joint booking discount', clientId: 'jan', amount: -450 },
        ],
      } as any,
    });
    expect(url).toContain('amountPaid=3420');
    expect(url).toContain('totalAmount=8550');
    expect(url).not.toContain('totalAmount=17100');
  });
});
