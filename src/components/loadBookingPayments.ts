import { Payment } from '../types';
import { paymentsApi } from '../services/api';

export const loadBookingPayments = async (bookingId: string, bookingHash?: string): Promise<Payment[]> => {
  const results = await Promise.allSettled([
    paymentsApi.getByBooking(bookingId),
    bookingHash ? paymentsApi.getByBookingHash(bookingHash) : Promise.resolve({ data: [] as Payment[] }),
  ]);
  const payments = new Map<string, Payment>();
  results.forEach(result => {
    if (result.status !== 'fulfilled') return;
    (result.value.data || []).forEach((payment: Payment) => {
      const key = payment._id || `${payment.display_id || ''}:${payment.paymentDate || ''}:${payment.amount || 0}`;
      payments.set(key, payment);
    });
  });
  if (!payments.size && results.every(result => result.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
  return Array.from(payments.values());
};
