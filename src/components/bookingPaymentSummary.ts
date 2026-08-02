import { Payment } from '../types';

const effectivePaymentAmount = (payment: Payment, bookingCurrency: string): number | null => {
  const amount = payment.currency === bookingCurrency
    ? Number(payment.amount || 0)
    : payment.bookingCurrency === bookingCurrency && Number.isFinite(Number(payment.bookingCurrencyAmount))
      ? Number(payment.bookingCurrencyAmount)
      : null;
  if (amount === null) return null;
  const refundedAmount = payment.currency === bookingCurrency ? Number(payment.refundedAmount || 0) : 0;
  const netAmount = Math.max(Math.abs(amount) - refundedAmount, 0);
  return payment.paymentType === 'refund' ? -netAmount : netAmount;
};

export const getBookingPaidAmount = (
  payments: Payment[],
  bookingCurrency: string,
  storedAmountPaid?: number | null,
): number => {
  const completedAmounts = payments
    .filter((payment) => payment.status === 'completed')
    .map((payment) => effectivePaymentAmount(payment, bookingCurrency))
    .filter((amount): amount is number => amount !== null);

  if (completedAmounts.length > 0) {
    return Math.max(0, completedAmounts.reduce((sum, amount) => sum + amount, 0));
  }

  return Math.max(0, Number(storedAmountPaid || 0));
};
