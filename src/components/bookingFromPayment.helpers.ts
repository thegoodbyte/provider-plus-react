import { Payment, PaymentRequest } from '../types';

const resolveId = (value: string | { _id?: string; id?: string } | null | undefined) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const resolveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

type BuildBookingCreateUrlInput = {
  payment: Payment;
  clientId?: string;
  retreatId?: string;
  paymentRequest?: PaymentRequest | null;
};

export const buildBookingCreateUrlFromPayment = ({
  payment,
  clientId,
  retreatId,
  paymentRequest,
}: BuildBookingCreateUrlInput) => {
  const params = new URLSearchParams();
  const resolvedClientId = clientId || resolveId(payment.clientId);
  const resolvedRetreatId = retreatId || resolveId(payment.retreatId);
  const resolvedPaymentRequestId = resolveId(paymentRequest || payment.paymentRequestId);
  const resolvedCurrency = payment.bookingCurrency || payment.currency || paymentRequest?.currency;
  const resolvedAmount = resolveNumber(payment.bookingCurrencyAmount)
    || resolveNumber(payment.amount)
    || resolveNumber(paymentRequest?.fullPriceQuote)
    || resolveNumber(paymentRequest?.fullPrice);

  if (resolvedClientId) params.set('clientId', resolvedClientId);
  if (resolvedRetreatId) params.set('retreatId', resolvedRetreatId);
  if (resolvedPaymentRequestId) params.set('paymentRequestId', resolvedPaymentRequestId);
  if (resolvedCurrency) params.set('currency', resolvedCurrency);
  if (resolvedAmount !== undefined) {
    params.set('amountPaid', String(resolveNumber(payment.amount) ?? resolvedAmount));
    params.set('totalAmount', String(resolvedAmount));
  }
  if (payment.status) {
    params.set('status', payment.status === 'completed' ? 'confirmed' : 'pending');
  }
  params.set('paymentId', payment._id || '');

  return `/admin/bookings/new?${params.toString()}`;
};
