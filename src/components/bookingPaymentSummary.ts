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

export const getBookingUsdBalance = (totalUsd: number | null, payments: Payment[]): { paidUsd: number; balanceUsd: number } | null => {
  if (totalUsd === null || !Number.isFinite(totalUsd)) return null;
  const paidUsd = payments
    .filter((payment) => payment.status === 'completed')
    .reduce((sum, payment) => {
      const amount = payment.currency === 'USD' ? Number(payment.amount || 0) : Number(payment.usd_amount);
      if (!Number.isFinite(amount)) return sum;
      const direction = payment.paymentType === 'refund' ? -1 : 1;
      return sum + (Math.abs(amount) * direction);
    }, 0);
  const roundedPaidUsd = Math.round(Math.max(0, paidUsd) * 100) / 100;
  const balanceUsd = Math.round(Math.max(0, totalUsd - roundedPaidUsd) * 100) / 100;
  return { paidUsd: roundedPaidUsd, balanceUsd };
};
