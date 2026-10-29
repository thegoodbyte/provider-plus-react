import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { paymentRequestsApi } from '../services/api';
import { clientBookingsPath } from './PaymentRequestBookingLinks';
import { apiErrorMessage } from '../utils/apiErrorMessage';

export default function RequestBookingReviewPage() {
  const location = useLocation();
  const requestId = new URLSearchParams(location.search).get('requestId') || undefined;
  const bookingId = new URLSearchParams(location.search).get('bookingId') || '';
  const [rows, setRows] = useState<any[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [selected, setSelected] = useState<any>(null), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setRows((await paymentRequestsApi.getBookingLinkReview(requestId)).data || []); }
    catch (e) { setError(apiErrorMessage(e, 'Unable to load booking link review.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps
  const link = async () => {
    if (!confirmed || !selected || busy) return;
    setBusy(true); setError('');
    try { await paymentRequestsApi.linkBooking(selected.request._id, selected.booking._id); setSelected(null); setConfirmed(false); setNotice('Existing payments linked and booking balance refreshed. No new payment or booking was created.'); await load(); }
    catch (e) { setError(apiErrorMessage(e, 'Unable to link booking. Refresh and review the records.')); }
    finally { setBusy(false); }
  };
  const visibleRows = rows.filter(row => !bookingId || row.candidates.some((booking: any) => booking._id === bookingId));
  return <div className="p-6 max-sm:p-4">
    <Link className="text-blue-700 underline" to="/admin/payment-requests">← Payment requests</Link>
    <h1 className="mt-4 text-2xl font-semibold">Booking link review</h1>
    <p className="my-3 text-sm text-gray-600">Requests with missing booking links or unallocated payments. Existing booking references and same-client, same-retreat suggestions are shown for staff review. A suggestion is not a confirmed link. Services, events and cancelled requests are excluded.</p>
    <div className="my-4 flex flex-wrap gap-3"><input aria-label="Search booking link review" className="rounded-md border px-3 py-2" placeholder="Request number or client" value={search} onChange={e => setSearch(e.target.value)} /><button type="button" className="rounded-md border px-3 py-2" disabled={loading || busy} onClick={load}>Refresh</button>{requestId && <Link className="self-center text-blue-700 underline" to="/admin/payment-requests/booking-review">Review all requests</Link>}</div>
    {bookingId && <Link className="text-blue-700 underline" to={`/admin/bookings/${encodeURIComponent(bookingId)}`}>Return to booking</Link>}
    {notice && <p role="status" className="my-3 text-green-800">{notice}</p>}
    {error && !selected && <p role="alert" className="my-3 text-red-800">{error}</p>}
    {loading ? <p role="status">Loading booking link review…</p> : <>
      <p className="my-3 text-sm">{visibleRows.length} requests need review</p>
      {!visibleRows.length && !error && <p>No requests need booking link review.</p>}
      {visibleRows.filter(row => `${row.request.invoiceNumber || row.request.display_id} ${row.request.clientId?.firstName || ''} ${row.request.clientId?.lastName || ''}`.toLowerCase().includes(search.toLowerCase())).map(row => {
        const request = row.request, clientId = typeof request.clientId === 'string' ? request.clientId : request.clientId?._id;
        return <section key={request._id} className="my-4 rounded-lg border bg-white p-4">
          <h2 className="font-semibold"><Link className="text-blue-700 underline" to={`/admin/payment-requests/${request._id}`}>Request #{request.invoiceNumber || request.display_id}</Link> · {[request.clientId?.firstName, request.clientId?.lastName].filter(Boolean).join(' ')}</h2>
          <p className="my-2 text-sm">{row.message}</p>
          {row.unallocatedPayments?.map((payment: any) => <p key={payment._id} className="my-1 text-sm">Unallocated payment #{payment.display_id || payment._id}: {payment.amount} {payment.currency} · {payment.status}</p>)}
          {clientId && <Link className="text-blue-700 underline" to={clientBookingsPath(clientId)}>Client bookings</Link>}
          {row.candidates.filter((booking: any) => !bookingId || booking._id === bookingId).map((booking: any) => <div key={booking._id} className="mt-3 rounded-md bg-gray-50 p-3">
            <Link className="font-medium text-blue-700 underline" to={`/admin/bookings/${booking._id}`}>Booking #{booking.bookingNumber || booking._id}</Link>
            <p className="text-sm">{booking.status} · {booking.currency}{booking.checkInDate ? ` · ${booking.checkInDate.slice(0,10)}` : ''}</p>
            <p className="my-1 text-sm">{booking.evidence}</p>
            {booking.blockedReason ? <p className="text-sm text-amber-800">{booking.blockedReason}</p> : <button type="button" className="mt-2 rounded-md border border-blue-600 px-3 py-2 text-blue-700" disabled={busy} onClick={() => { setSelected({ request, booking }); setConfirmed(false); setError(''); }}>Link request #{request.invoiceNumber || request.display_id} to booking #{booking.bookingNumber || booking._id}</button>}
          </div>)}
        </section>;
      })}
    </>}
    {selected && <div role="dialog" aria-modal="true" aria-label="Confirm existing booking link" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-w-lg rounded-lg bg-white p-6">
      <h2 className="text-lg font-semibold">Link existing booking</h2>{error && <p role="alert" className="my-3 text-red-800">{error}</p>}<p className="my-3">Link request #{selected.request.invoiceNumber || selected.request.display_id} to booking #{selected.booking.bookingNumber || selected.booking._id}? Existing unallocated payments for this request will be attached. Amounts, currency rates and the booking’s primary request stay unchanged.</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I checked the client, retreat and existing booking and confirm this relationship.</label>
      <div className="mt-4 flex gap-3"><button type="button" disabled={busy} className="rounded-md border px-3 py-2" onClick={() => setSelected(null)}>Cancel</button><button type="button" disabled={!confirmed || busy} className="rounded-md bg-blue-700 px-3 py-2 text-white disabled:opacity-40" onClick={link}>{busy ? 'Linking…' : 'Confirm booking link'}</button></div>
    </div></div>}
  </div>;
}
