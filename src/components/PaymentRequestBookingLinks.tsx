import React from 'react';
import { Link } from 'react-router-dom';
import { requestBookingReferences, requestBookingState } from './requestBookingState';

const id = (value: any): string => typeof value === 'string' ? value : value?._id || value?.id || '';
export const clientBookingsPath = (clientId: string) => `/admin/clients/${encodeURIComponent(clientId)}?tab=bookings`;

export default function PaymentRequestBookingLinks({ request }: { request: any }) {
  const bookings = requestBookingReferences(request);
  const state = requestBookingState(request);
  const clientId = id(request.clientId);
  return <div className="flex flex-col items-start gap-1 text-sm">
    {state === 'waiting' && <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Booking after payment</span>}
    {state === 'needed' && <span className="rounded bg-amber-100 px-2 py-1 font-semibold text-amber-950">Booking needed</span>}
    {state === 'review' && <span className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-950">Review booking links</span>}
    {bookings.size ? [...bookings].map(([bookingId, booking]) => <Link key={bookingId} className="text-blue-700 underline" to={`/admin/bookings/${encodeURIComponent(bookingId)}`}>{booking.bookingNumber ? `Booking #${booking.bookingNumber}` : 'View linked booking'}</Link>) : <><span className="text-gray-500">No booking linked</span>{request._id && <Link className="text-blue-700 underline" to={`/admin/payment-requests/booking-review?requestId=${encodeURIComponent(request._id)}`}>Review booking links</Link>}</>}
    {bookings.size > 0 && request._id && request.context !== 'standalone_service' && <Link className="text-blue-700 underline" to={`/admin/payment-requests/booking-review?requestId=${encodeURIComponent(request._id)}`}>Review payment allocation</Link>}
    {clientId && <Link className="text-blue-700 underline" to={clientBookingsPath(clientId)}>Client bookings</Link>}
  </div>;
}
