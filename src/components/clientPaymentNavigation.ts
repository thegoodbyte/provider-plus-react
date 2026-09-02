export const clientPaymentCreatePath = (clientId: string, bookings: Array<{ _id?: string }> = []) => {
  const params = new URLSearchParams({ clientId });
  if (bookings.length === 1 && bookings[0]?._id) params.set('bookingId', bookings[0]._id);
  return `/admin/payments/new?${params.toString()}`;
};

export const clientPaymentEditPath = (paymentId: string) => `/admin/payments/${encodeURIComponent(paymentId)}/edit`;
