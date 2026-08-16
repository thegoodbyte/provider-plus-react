import { BookingFlowItem, Payment, PaymentRequest } from '../types';

export const evidenceReceivedStatuses = new Set<BookingFlowItem['status']>(['received', 'reviewed', 'approved', 'caution', 'completed']);
export const reviewedStatuses = new Set<BookingFlowItem['status']>(['reviewed', 'approved', 'completed', 'caution', 'rejected', 'needs_resubmission']);
export const satisfiedStatuses = new Set<BookingFlowItem['status']>(['received', 'reviewed', 'approved', 'caution', 'completed', 'waived']);
export const accomplishedStatuses = new Set<BookingFlowItem['status']>(['received', 'reviewed', 'approved', 'caution', 'completed', 'waived', 'sent']);
export const failedStatuses = new Set<BookingFlowItem['status']>(['rejected', 'needs_resubmission', 'blocked']);
export const attentionStatuses = new Set<BookingFlowItem['status']>(['caution', 'sent_for_review', 'in_review']);

export const hasReceivedEvidence = (status?: BookingFlowItem['status']) => Boolean(status && evidenceReceivedStatuses.has(status));
export const isReviewedStatus = (status?: BookingFlowItem['status']) => Boolean(status && reviewedStatuses.has(status));
export const isSatisfiedStatus = (status?: BookingFlowItem['status']) => Boolean(status && satisfiedStatuses.has(status));
export const isAccomplishedStatus = (status?: BookingFlowItem['status']) => Boolean(status && accomplishedStatuses.has(status));

const confirmationKey = 'booking_confirmation_sent';
export const sentConfirmationStep = (items: BookingFlowItem[] = []) => items.find(item =>
  String(item?.key || '').toLowerCase() === confirmationKey && isAccomplishedStatus(item.status)
);
export const confirmationState = (booking: any, items: BookingFlowItem[] = []) => {
  const history = [...(booking?.bookingConfirmationHistory || [])].sort((a: any, b: any) => new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime());
  const step = sentConfirmationStep(items);
  return {
    sent: history.length > 0 || Boolean(step),
    sentAt: history[0]?.sentAt || history[0]?.createdAt || step?.emailSentAt || step?.sentAt || step?.completedAt || step?.updatedAt,
    history,
    step,
  };
};

export const isActivePaymentRequest = (request: Partial<PaymentRequest>) => !['cancelled', 'paid', 'expired', 'failed'].includes(String(request.status || '').toLowerCase());
export const bookingCurrencyPaymentAmount = (payment: Partial<Payment>, currency: string) => {
  if (String(payment.status || '').toLowerCase() !== 'completed') return 0;
  const sign = payment.paymentType === 'refund' ? -1 : 1;
  const refunded = Number(payment.refundedAmount || 0);
  if (payment.currency === currency) return sign * Math.max(Math.abs(Number(payment.amount || 0)) - refunded, 0);
  if (payment.bookingCurrency === currency && Number(payment.bookingCurrencyAmount)) return sign * Math.abs(Number(payment.bookingCurrencyAmount));
  return 0;
};
export const bookingPaymentSummary = (payments: Partial<Payment>[], total: number, currency: string) => {
  const received = payments.reduce((sum, payment) => sum + bookingCurrencyPaymentAmount(payment, currency), 0);
  const outstanding = Math.max(0, Number(total || 0) - received);
  return { received, outstanding, paidPercent: total > 0 ? Math.min(100, Math.max(0, Math.round(received / total * 100))) : 0, paidInFull: total > 0 && outstanding < 0.01 };
};
