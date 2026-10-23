import React from 'react';
import { Link } from 'react-router-dom';

const id = (value: any): string => typeof value === 'string' ? value : value?._id || value?.id || '';
export const clientBookingsPath = (clientId: string) => `/admin/clients/${encodeURIComponent(clientId)}?tab=bookings`;

export default function PaymentRequestBookingLinks({ request }: { request: any }) {
  const bookings = new Map<string, any>();
  for (const value of [request.bookingId, ...(request.lineItems || []).map((item: any) => item.bookingId)]) {
    if (id(value) && (!bookings.has(id(value)) || value?.bookingNumber)) bookings.set(id(value), value);
  }
  const clientId = id(request.clientId);
  return <div className="flex flex-col items-start gap-1 text-sm">
    {bookings.size ? [...bookings].map(([bookingId, booking]) => <Link key={bookingId} className="text-blue-700 underline" to={`/admin/bookings/${encodeURIComponent(bookingId)}`}>{booking.bookingNumber ? `Booking #${booking.bookingNumber}` : 'View linked booking'}</Link>) : <span className="text-gray-500">No booking linked</span>}
    {clientId && <Link className="text-blue-700 underline" to={clientBookingsPath(clientId)}>Client bookings</Link>}
  </div>;
}
