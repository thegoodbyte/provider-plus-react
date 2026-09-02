import { bookingFinancialSummary, paymentRequestFinancialSummary } from './bookingFinancialSummary';
describe('booking financial summary', () => {
  it('reports the server-maintained booking balance', () => expect(bookingFinancialSummary({ totalAmount: 8500, amountPaid: 3420, currency: 'PLN' })).toMatchObject({ price: 8500, netPaid: 3420, balance: 5080, overpayment: 0, state: 'partial' }));
  it('reports refunds and overpayments without negative balances', () => expect(bookingFinancialSummary({ totalAmount: 1000, grossReceived: 1200, amountPaid: 1100 })).toMatchObject({ refunded: 100, balance: 0, overpayment: 100, state: 'overpaid' }));
  it('uses the server USD settlement when currencies differ', () => expect(bookingFinancialSummary({ totalAmount: 7500, amountPaid: 4788.46, totalAmountUsd: 1950, amountPaidUsd: 2050 })).toMatchObject({ balance: 0, state: 'overpaid' }));
  it('normalizes request values without truthy fallbacks', () => expect(paymentRequestFinancialSummary({ requestedAmount: 3420, fullPrice: 8550, fullPriceQuote: 17100, currency: 'PLN' })).toEqual({ requested: 3420, quotedPrice: 8550, currency: 'PLN' }));
  it('treats the backend ledger summary as authoritative', () => expect(bookingFinancialSummary({ totalAmount: 999, amountPaid: 0, financialSummary: { price: 8500, currency: 'PLN', grossReceived: 3420, refunded: 0, netPaid: 3420, balance: 5080, overpayment: 0, paidInFull: false, state: 'partial' } }).price).toBe(8500));
});
