import { Payment } from '../types';
import { getBookingPaidAmount } from './bookingPaymentSummary';

const payment = (overrides: Partial<Payment>): Payment => ({
  clientId: 'client-1',
  retreatId: 'retreat-1',
  amount: 0,
  currency: 'PLN',
  status: 'completed',
  paymentMethod: 'revolut',
  paymentType: 'regular_payment',
  paymentDate: '2026-08-01',
  isDeposit: false,
  isFinalPayment: false,
  isRefundable: true,
  ...overrides,
});

describe('getBookingPaidAmount', () => {
  it('uses linked completed payments instead of a stale booking amountPaid value', () => {
    const payments = [
      payment({ amount: 3000, paymentType: 'deposit_non_refundable', isDeposit: true }),
      payment({ amount: 4500, paymentType: 'balance_payment', isFinalPayment: true }),
    ];

    expect(getBookingPaidAmount(payments, 'PLN', 3000)).toBe(7500);
  });

  it('uses explicit booking-currency equivalents for cross-currency payments', () => {
    expect(getBookingPaidAmount([
      payment({ amount: 1000, currency: 'USD', bookingCurrency: 'PLN', bookingCurrencyAmount: 4000 }),
    ], 'PLN', 0)).toBe(4000);
  });

  it('falls back to stored amountPaid when no payment can be counted in booking currency', () => {
    expect(getBookingPaidAmount([
      payment({ amount: 1000, currency: 'USD' }),
    ], 'PLN', 3000)).toBe(3000);
  });
});
