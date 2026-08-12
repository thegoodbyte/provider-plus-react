import { BookingFlowItem, Payment } from '../types';

export type BookingStepPaymentSelection = {
  payment: Payment;
  receivedAt: string;
  metadata: Record<string, any>;
  update: Partial<BookingFlowItem>;
  action: Record<string, any>;
};

export const resolveBookingStepPaymentDate = (payment: Payment, now = new Date()): string => {
  const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : now;
  return Number.isNaN(paymentDate.getTime()) ? now.toISOString() : paymentDate.toISOString();
};

export const buildBookingStepPaymentSelection = (item: BookingFlowItem | undefined, paymentId: string, payments: Payment[], now = new Date()): BookingStepPaymentSelection | null => {
  if (!item?._id || !paymentId) return null;
  const payment = payments.find((candidate) => candidate._id === paymentId);
  if (!payment) return null;
  const receivedAt = resolveBookingStepPaymentDate(payment, now);
  const metadata = {
    ...(item.metadata || {}),
    paymentId: payment._id,
    paymentDisplayId: payment.display_id,
    paymentAmount: payment.amount,
    paymentCurrency: payment.currency,
    paymentDate: receivedAt,
    paymentMethod: payment.paymentMethod,
    paymentStatus: payment.status,
  };
  return {
    payment,
    receivedAt,
    metadata,
    update: { status: 'received', receivedAt, metadata },
    action: {
      actionType: 'manual_mark',
      actionKey: 'payment_selected',
      actionLabel: 'Payment selected',
      statusAfter: 'received',
      notes: `Payment ${payment.display_id ? `#${payment.display_id}` : payment._id} selected for Payment received.`,
      metadata,
    },
  };
};
