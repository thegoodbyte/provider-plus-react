import { getEffectivePaidAmount, getPaymentAmountInBookingCurrency } from './retreatPaymentUtils';
import { Payment } from '../types';

const payment = (overrides: Partial<Payment>): Payment => ({
  clientId: 'client-1',
  retreatId: 'retreat-1',
  amount: 0,
  currency: 'EUR',
  status: 'completed',
  paymentMethod: 'bank_transfer',
  paymentType: 'regular_payment',
  paymentDate: '2026-08-08',
  isDeposit: false,
  isFinalPayment: false,
  isRefundable: false,
  ...overrides,
});

describe('getPaymentAmountInBookingCurrency', () => {
  it('uses the stored booking-currency amount for a cross-currency payment', () => {
    expect(getPaymentAmountInBookingCurrency(payment({
      amount: 800,
      currency: 'EUR',
      bookingCurrency: 'PLN',
      bookingCurrencyAmount: 3323.08,
    }), 'PLN')).toBeCloseTo(3323.08);
  });

  it('does not invent a booking-currency value when the recorded conversion is missing', () => {
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 800, currency: 'EUR' }), 'PLN')).toBe(0);
  });

  it('subtracts refunds and ignores incomplete payments', () => {
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 1000, refundedAmount: 250 }), 'EUR')).toBe(750);
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 1000, status: 'pending' }), 'EUR')).toBe(0);
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 100, paymentType: 'refund' }), 'EUR')).toBe(-100);
  });
});

describe('getEffectivePaidAmount', () => {
  it('recognizes a legacy cross-currency booking as paid from its USD totals', () => {
    expect(getEffectivePaidAmount(9500, 2470, 0, 2470)).toBeCloseTo(9500);
  });

  it('converts a partial USD payment proportionally into the booking currency', () => {
    expect(getEffectivePaidAmount(9500, 2470, 0, 1235)).toBeCloseTo(4750);
  });
});
