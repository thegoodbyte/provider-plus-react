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
});
