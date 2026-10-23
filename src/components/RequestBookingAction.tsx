import React, { useState } from 'react';
import { paymentRequestsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PaymentRequest } from '../types';
const id = (value: any): string => String(value?._id || value || '');

export default function RequestBookingAction({ request, compact = false }: { request: Partial<PaymentRequest>; compact?: boolean }) {
  const navigate = useNavigate();
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [existing,setExisting] = useState<any[]>([]);
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
  const check = async (event: React.MouseEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const fresh = (await paymentRequestsApi.getOneFresh(id(request._id))).data;
      if (fresh.bookingId) { navigate(`${prefix}/bookings/${encodeURIComponent(id(fresh.bookingId))}`); return; }
      if (fresh.status === 'cancelled' || fresh.requestType === 'additional' || fresh.context && fresh.context !== 'retreat' || id(fresh.clientId) !== id(request.clientId) || id(fresh.retreatId) !== id(request.retreatId)) throw new Error('Request changed. Refresh and review its client and retreat.');
      const review = (await paymentRequestsApi.getBookingLinkReview(id(request._id))).data;
      const candidates = (review || []).find((row: any) => id(row.request._id) === id(request._id))?.candidates || [];
      const active = candidates.filter((booking: any) => !['cancelled','canceled'].includes(booking.status) || booking.evidence === 'Existing booking/payment reference');
      if (active.length) { setExisting(active); return; }
      query.set('totalAmount',String(fresh.fullPriceQuote ?? fresh.fullPrice));
      query.set('currency',String(fresh.currency));
      navigate(`${prefix}/bookings/new?${query}`);
    } catch (e) { setError(apiErrorMessage(e,'Unable to check existing bookings. Refresh and try again.')); }
    finally { setBusy(false); }
  };
  return <div className={compact ? 'mt-2 text-sm' : "mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4"}><p className={compact ? 'sr-only' : "mb-3 text-sm text-blue-900"}>Ready to book? Review the booking details, then save to connect this request and its existing payments. Opening the form does not create a booking.</p><Link className="inline-flex rounded bg-blue-700 px-4 py-2 font-semibold text-white" to={`${prefix}/bookings/new?${query}`} onClick={check} aria-disabled={busy}>{busy ? 'Checking bookings…' : 'Create booking'}</Link>{error && <p role="alert" className="mt-2 text-red-800">{error}</p>}{existing.length > 0 && <div className="mt-3"><p>A booking already exists for this client and retreat. Review it before creating another.</p>{existing.map(booking => <Link key={booking._id} className="mr-3 text-blue-700 underline" to={`${prefix}/bookings/${booking._id}`}>Booking #{booking.bookingNumber || booking._id}</Link>)}<Link className="text-blue-700 underline" to={`${prefix}/payment-requests/booking-review?requestId=${id(request._id)}`}>Review and link existing booking</Link></div>}</div>;
}
