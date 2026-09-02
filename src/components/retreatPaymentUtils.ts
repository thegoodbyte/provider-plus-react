import { Payment } from '../types';
import { bookingCurrencyPaymentAmount } from './bookingStatusSelectors';
import { bookingFinancialSummary } from './bookingFinancialSummary';

export const getPaymentAmountInBookingCurrency = (payment: Payment, bookingCurrency: string) =>
  bookingCurrencyPaymentAmount(payment, bookingCurrency);

export const getEffectivePaidAmount = (
  totalAmount: number,
  totalAmountUSD: number,
  amountPaid: number,
  amountPaidUSD: number,
) => {
  return bookingFinancialSummary({ totalAmount, totalAmountUSD, amountPaid, amountPaidUSD }).netPaid;
};
