import { Payment } from '../types';
import { bookingCurrencyPaymentAmount } from './bookingStatusSelectors';

export const getPaymentAmountInBookingCurrency = (payment: Payment, bookingCurrency: string) =>
  bookingCurrencyPaymentAmount(payment, bookingCurrency);

export const getEffectivePaidAmount = (
  totalAmount: number,
  totalAmountUSD: number,
  amountPaid: number,
  amountPaidUSD: number,
) => {
  const paidFromUsd = totalAmountUSD > 0 ? (amountPaidUSD / totalAmountUSD) * totalAmount : 0;
  return Math.max(amountPaid, paidFromUsd);
};
