import { bookingPriceFromPaymentRequest, bookingPriceLinesForClient } from './bookingPaymentRequestPricing';

describe('booking payment-request pricing', () => {
  const request: any = {
    fullPriceQuote: 17100,
    lineItems: [
      { type: 'charge', description: 'Anna stay', clientId: 'anna', amount: 9000 },
      { type: 'discount', description: 'Anna joint-booking discount', clientId: 'anna', amount: -450 },
      { type: 'charge', description: 'Jan stay', clientId: 'jan', amount: 9000 },
      { type: 'discount', description: 'Jan joint-booking discount', clientId: 'jan', amount: -450 },
    ],
  };

  it('uses only the selected client price lines instead of the combined quote', () => {
    expect(bookingPriceLinesForClient(request, 'anna')).toHaveLength(2);
    expect(bookingPriceFromPaymentRequest(request, 'anna')).toBe(8550);
  });

  it('does not copy an ambiguous multi-person total into one booking', () => {
    expect(bookingPriceFromPaymentRequest(request, 'unknown')).toBeUndefined();
  });

  it('uses the full retreat price when a deposit request has installment line items', () => {
    expect(bookingPriceFromPaymentRequest({
      requestType: 'deposit',
      fullPrice: 9445,
      requestedAmount: 4000,
      lineItems: [{ type: 'charge', description: 'Deposit', amount: 4000 }],
    } as any, 'client-1')).toBe(9445);
  });

  it('does not turn an additional medical fee into the retreat booking price', () => {
    expect(bookingPriceFromPaymentRequest({
      requestType: 'additional',
      fullPrice: 25,
      requestedAmount: 25,
      currency: 'EUR',
    } as any, 'client-1')).toBeUndefined();
  });
});
