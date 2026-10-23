import { Link, useLocation } from 'react-router-dom';
import { PaymentRequest } from '../types';
const id = (value: any): string => String(value?._id || value || '');

export default function RequestBookingAction({ request }: { request: Partial<PaymentRequest> }) {
  const location = useLocation();
  const first = location.pathname.split('/').filter(Boolean)[0];
  const prefix = ['admin', 'medical', 'staff', 'user'].includes(first) ? `/${first}` : '';
  if ((request as any).context === 'standalone_service') return null;
  const bookingId = id(request.bookingId);
  if (bookingId) return <Link className="inline-flex rounded border border-blue-300 px-4 py-2 font-semibold text-blue-700" to={`${prefix}/bookings/${encodeURIComponent(bookingId)}`}>Open booking</Link>;
  const clients = new Set((request.lineItems || []).map(item => id(item.clientId)).filter(Boolean));
  if (clients.size > 1) return <p className="text-sm text-gray-600">This request covers multiple participants. Create each participant’s booking when confirmed and allocate the received payment across those bookings.</p>;
  const fullPrice = Number(request.fullPriceQuote ?? request.fullPrice);
  if (request.status === 'cancelled' || request.requestType === 'additional' || !id(request.clientId) || !id(request.retreatId) || !request._id || !request.currency || !(fullPrice > 0)) return null;
  const query = new URLSearchParams({ paymentRequestId: id(request._id), clientId: id(request.clientId), retreatId: id(request.retreatId), totalAmount: String(fullPrice), currency: request.currency });
  if (request.bookingType) query.set('bookingType', request.bookingType);
  if (request.ceremonyId) query.set('ceremonyId', id(request.ceremonyId));
  if (request.ceremonyNumber) query.set('ceremonyNumber', String(request.ceremonyNumber));
  return <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4"><p className="mb-3 text-sm text-blue-900">Ready to book? Review the booking details, then save to connect this request and its existing payments. Opening the form does not create a booking.</p><Link className="inline-flex rounded bg-blue-700 px-4 py-2 font-semibold text-white" to={`${prefix}/bookings/new?${query}`}>Create booking</Link></div>;
}
