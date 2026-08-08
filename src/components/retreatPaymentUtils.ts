import { Payment } from '../types';

export const getPaymentAmountInBookingCurrency = (payment: Payment, bookingCurrency: string) => {
  if (payment.status !== 'completed') return 0;

  const amount = Math.abs(Number(payment.amount || 0));
  const refundedAmount = Math.max(Number(payment.refundedAmount || 0), 0);
  const remainingRatio = amount > 0 ? Math.max(amount - refundedAmount, 0) / amount : 1;
  const sign = payment.paymentType === 'refund' ? -1 : 1;

  if (String(payment.currency || '').toUpperCase() === bookingCurrency.toUpperCase()) {
    return sign * Math.max(amount - refundedAmount, 0);
  }

  if (
    String(payment.bookingCurrency || '').toUpperCase() === bookingCurrency.toUpperCase()
    && Number(payment.bookingCurrencyAmount) > 0
  ) {
    return sign * Math.abs(Number(payment.bookingCurrencyAmount)) * remainingRatio;
  }

  return 0;
};
