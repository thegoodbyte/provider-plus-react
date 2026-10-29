import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import CurrencyDisplay from './CurrencyDisplay';
import { paymentsApi } from '../services/api';
import { useBookingRequirements } from './useBookingRequirements';
import { confirmationState } from './bookingStatusSelectors';
import { formatCalendarDate, parseCalendarDate } from '../utils/dateFormat';
import { BookingType } from '../constants/eventTypes';

export const formatBookingDate = (date?: string | Date) => {
  if (!date) return 'N/A';
  const value = new Date(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date);
  return Number.isNaN(value.getTime()) ? 'N/A' : value.toLocaleDateString('en-US', {timeZone:'Europe/Prague',year:'numeric',month:'short',day:'numeric'});
};
export const formatHistoryDateTime = (date?: string | Date) => { if (!date) return 'N/A'; const value = new Date(date); if (Number.isNaN(value.getTime())) return 'N/A'; return value.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
export const retreatTown = (retreat: any) => String(retreat?.location_town || retreat?.locationTown || retreat?.generalTown || retreat?.general_town || retreat?.house?.generalTown || retreat?.house?.general_town || retreat?.house?.city || retreat?.houseId?.generalTown || retreat?.houseId?.general_town || retreat?.houseId?.city || retreat?.location || '').trim();
export { sentConfirmationStep } from './bookingStatusSelectors';

type Props = { refreshKey?: number; bookingId: string; booking: any; client: any; retreat: any; clientName: string; bookingTypeCode: string; retreatCode: string; retreatAddress: string; onEditClient: () => void; onBookingRefresh: () => void; onOpenTab?: (tab: 'payments' | 'requirements' | 'medical') => void; onSendConfirmation?: () => void; };
const objectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;
const dateValue = (retreat: any, edge: 'startDate' | 'endDate', booking?: any) => {
  if (booking?.bookingType === BookingType.BOOSTER) {
    const candidates = edge === 'startDate'
      ? [booking.boosterStartDate, booking.booster_start_date, booking.arrivalDate, booking.arrival_date, booking.checkInDate, booking.check_in_date, booking.startDate, booking.ceremonyId?.date]
      : [booking.boosterEndDate, booking.booster_end_date, booking.departureDate, booking.departure_date, booking.checkOutDate, booking.check_out_date, booking.endDate, booking.boosterCheckoutDate];
    const value = candidates.find(Boolean);
    if (value) return value;
  }
  return retreat?.[edge] || retreat?.dates?.[edge];
};
const timeValue = (retreat: any, edge: 'startTime' | 'endTime', booking?: any) => {
  if (booking?.bookingType === BookingType.BOOSTER) {
    const candidates = edge === 'startTime'
      ? [booking.boosterStartTime, booking.booster_start_time, booking.arrivalTime, booking.arrival_time, booking.checkInTime, booking.check_in_time, booking.startTime, booking.ceremonyId?.startTime]
      : [booking.boosterEndTime, booking.booster_end_time, booking.departureTime, booking.departure_time, booking.checkOutTime, booking.check_out_time, booking.endTime, booking.ceremonyId?.endTime];
    const value = candidates.find(Boolean);
    if (value) return value;
  }
  return retreat?.[edge] || retreat?.dates?.[edge] || '';
};
export const bookingStartDays = (value: string | Date | undefined, now = new Date()) => {
  const date = parseCalendarDate(value);
  if (!date) return null;
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(date) - day(now)) / 86400000);
};

const Card: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, action, children, className = '' }) =>
  <section aria-label={title} className={`min-w-0 rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {action}
    </div>
    {children}
  </section>;

const BookingOverviewPanel: React.FC<Props> = ({ bookingId, booking, client, retreat, clientName, retreatCode, retreatAddress, onEditClient, onOpenTab, onSendConfirmation, refreshKey = 0 }) => {
  const clientId = objectId(client); const retreatId = objectId(retreat);
  const requirements = useBookingRequirements({ bookingId, clientId, retreatId, refreshKey });
  const confirmation = useMemo(() => confirmationState(booking, requirements.items), [booking, requirements.items]);
  const confirmationSent = confirmation.sent; const confirmationSentAt = confirmation.sentAt;
  const missingRows = requirements.rows.filter(row => row.required && !row.satisfied);
  const start = dateValue(retreat, 'startDate', booking); const end = dateValue(retreat, 'endDate', booking);
  const startTime = timeValue(retreat, 'startTime', booking); const endTime = timeValue(retreat, 'endTime', booking);
  const startIn = bookingStartDays(start);
  const checkIn = start; const checkOut = end;
  const confirmationLabel = confirmationSent ? 'Confirmation sent' : requirements.loading ? 'Checking confirmation…' : requirements.error ? 'Confirmation unavailable' : 'Confirmation not sent';

  const [summary, setSummary] = useState<{ currency: string; price: number; netPaid: number; balance: number; overpayment: number; sourceState: string; paidInFull: boolean; refunded?: number } | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryAttempt, setSummaryAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSummaryLoading(true); setSummaryError(''); setSummary(null);
    paymentsApi.getFinancialSummary(bookingId).then(({ data }) => {
      if (!active) return;
      if (!data || typeof data.paidInFull !== 'boolean' || !['verified_ledger', 'missing_conversion', 'unreconciled_history'].includes(data.sourceState) || !['CZK', 'EUR', 'USD', 'PLN'].includes(data.currency) || !['price', 'netPaid', 'balance', 'overpayment'].every(key => typeof data[key] === 'number' && Number.isFinite(data[key])) || ['price', 'balance', 'overpayment'].some(key => data[key] < 0)) {
        throw new Error('Unavailable financial summary');
      }
      setSummary(data);
    }).catch(() => { if (active) setSummaryError('Financial summary unavailable.'); }).finally(() => { if (active) setSummaryLoading(false); });
    return () => { active = false; };
  }, [bookingId, refreshKey, summaryAttempt]);
  const isPaidInFull = Boolean(summary && summary.price > 0 && summary.sourceState === 'verified_ledger' && summary.paidInFull);
  const paidPercentage = summary && summary.price > 0 ? Math.min(isPaidInFull ? 100 : 99, Math.max(0, Math.round(summary.netPaid / summary.price * 100))) : isPaidInFull ? 100 : 0;

  return <div role="region" aria-label="Booking overview" className="grid gap-5 break-words xl:grid-cols-[minmax(0,1fr)_280px]">
    <div className="min-w-0 space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{booking?.bookingType === BookingType.BOOSTER ? 'Booster booking' : 'Retreat booking'}</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">{retreatCode || 'N/A'} · {retreat?.name || retreatTown(retreat) || 'Retreat'}</h2>
            <p className="mt-1 text-sm text-slate-600">{formatBookingDate(start)}{startTime ? ` · ${startTime}` : ''} – {formatBookingDate(end)}{endTime ? ` · ${endTime}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${startIn !== null && startIn < 0 ? 'bg-slate-100 text-slate-600' : startIn !== null && startIn <= 14 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
              {startIn === null ? 'Date unavailable' : startIn < 0 ? `Started ${Math.abs(startIn)}d ago` : startIn === 0 ? 'Starts today' : `Starts in ${startIn}d`}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${confirmationSent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{confirmationLabel}</span>
          </div>
        </div>
      </section>

      <Card title="Payment summary" action={<div className="flex items-center gap-2">
        <button type="button" aria-label="Refresh payment summary" onClick={() => setSummaryAttempt(value => value + 1)} disabled={summaryLoading} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><RefreshCw size={14} /></button>
        <button type="button" className="text-xs font-semibold text-blue-700 underline" disabled={!onOpenTab} onClick={() => onOpenTab?.('payments')}>View payments</button>
      </div>}>
        {summaryLoading ? <p role="status" className="text-sm text-slate-500">Loading payment summary…</p> : summaryError ? <div role="alert" className="text-sm text-red-700"><p>{summaryError}</p><button type="button" className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800" onClick={() => setSummaryAttempt(value => value + 1)}>Retry payment summary</button></div> : summary && <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-slate-500">Agreed price</p><p className="text-base font-bold text-slate-900"><CurrencyDisplay amount={summary.price} currency={summary.currency as any} showUSD={false} /></p></div>
            <div><p className="text-xs text-slate-500">Paid</p><p className="text-base font-bold text-slate-900"><CurrencyDisplay amount={summary.netPaid} currency={summary.currency as any} showUSD={false} /></p></div>
            <div><p className="text-xs text-slate-500">{summary.overpayment > 0 ? 'Overpaid · credit' : 'Balance due'}</p><p className={`text-base font-bold ${summary.overpayment > 0 ? 'text-blue-700' : summary.balance > 0 ? 'text-red-700' : 'text-slate-900'}`}><CurrencyDisplay amount={summary.overpayment > 0 ? summary.overpayment : summary.balance} currency={summary.currency as any} showUSD={false} /></p></div>
          </div>
          {summary.sourceState !== 'verified_ledger' ? <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Payment history needs reconciliation. Open payments to review.</p> : <div className="mt-4">
            <div role="progressbar" aria-label="Booking payment progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercentage} className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${isPaidInFull ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${paidPercentage}%` }} /></div>
            <p className="mt-1.5 text-xs font-semibold text-slate-500">{isPaidInFull ? summary.overpayment > 0 ? 'Paid in full · credit available' : 'Paid in full' : summary.price === 0 ? 'No booking price recorded' : `${paidPercentage}% paid`}</p>
          </div>}
          {Number(summary.refunded) > 0 && <p className="mt-2 text-xs text-slate-600">Includes <CurrencyDisplay amount={summary.refunded!} currency={summary.currency as any} showUSD={false} /> refunded. Paid is the net amount retained.</p>}
        </>}
      </Card>

      <Card title="Requirements" action={<button type="button" className="text-xs font-semibold text-blue-700 underline" disabled={!onOpenTab} onClick={() => onOpenTab?.('requirements')}>Open all requirements</button>}>
        {requirements.loading ? <p role="status" className="text-sm text-slate-500">Loading booking requirements…</p> : requirements.error ? <div role="alert" className="text-sm text-red-700"><p>{requirements.error}</p><button type="button" className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold" onClick={requirements.reload}>Retry requirements</button></div> : missingRows.length ? <>
          <p className="text-sm text-slate-700">{missingRows.length} required {missingRows.length === 1 ? 'item needs' : 'items need'} attention.</p>
          <ul className="mt-2 space-y-1.5">{missingRows.slice(0, 5).map(row => <li key={row.key} className="flex items-center gap-2 text-sm text-slate-700"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{row.label}{(row as any).canonicalState === 'unavailable' ? ' · status unavailable' : ''}</li>)}</ul>{missingRows.length > 5 && <p className="mt-2 text-xs text-slate-600">+{missingRows.length - 5} more · open all requirements to review.</p>}
        </> : <p className="text-sm text-green-700">No outstanding required items.</p>}
      </Card>

      <Card title="Retreat & dates">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Address</dt><dd className="text-sm text-slate-900">{retreatAddress || retreatTown(retreat) || 'N/A'}</dd></div>
          {retreat?.capacity && <div><dt className="text-xs text-slate-500">Capacity</dt><dd className="text-sm text-slate-900">{retreat.capacity} places</dd></div>}
          <div><dt className="text-xs text-slate-500">Check-in</dt><dd className="text-sm text-slate-900">{formatBookingDate(checkIn)}{startTime ? ` · ${startTime}` : ''}</dd></div>
          <div><dt className="text-xs text-slate-500">Check-out</dt><dd className="text-sm text-slate-900">{formatBookingDate(checkOut)}{endTime ? ` · ${endTime}` : ''}</dd></div>
          <div><dt className="text-xs text-slate-500">Booked</dt><dd className="text-sm text-slate-900">{formatBookingDate(booking.registrationDate || booking.createdAt)}</dd></div>
        </dl>
      </Card>
    </div>

    <aside aria-label="Booking client summary" className="min-w-0 space-y-5">
      <Card title="Client" action={<button type="button" className="text-xs font-semibold text-blue-700 underline" onClick={onEditClient}>Edit</button>}>
        <p className="text-sm font-bold text-slate-900">{clientName}</p>
        <dl className="mt-3 space-y-2.5">
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</dt><dd className="text-sm">{client?.email ? <a className="text-blue-700 underline" href={`mailto:${client.email}`}>{client.email}</a> : <span className="text-slate-900">N/A</span>}</dd></div>
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</dt><dd className="text-sm text-slate-900">{client?.phone || 'N/A'}</dd></div>
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Country</dt><dd className="text-sm text-slate-900">{client?.country || 'N/A'}</dd></div>
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Referral</dt><dd className="text-sm text-slate-900">{(typeof client?.referralId === 'object' ? client.referralId?.name : '') || client?.source || 'N/A'}{client?.referralAttributionType && client.referralAttributionType !== 'na' ? ` · ${client.referralAttributionType === 'direct' ? 'Direct' : 'Self-identified'}` : ''}</dd></div>
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Accommodation</dt><dd className="text-sm text-slate-900">{booking?.roomType === 'private_ensuite' ? 'Private room, private bathroom' : booking?.roomType === 'private' ? 'Private room' : booking?.roomType === 'shared' ? 'Shared room' : 'Not decided'}{booking?.roomNumber ? ` · ${booking.roomNumber}` : ''}</dd></div>
        </dl>
      </Card>

      <Card title="Confirmation">
        <p className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${confirmationSent ? 'bg-green-100 text-green-800' : requirements.error ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-700'}`}>
          {confirmationSent ? 'Sent' : requirements.loading ? 'Checking…' : requirements.error ? 'Status unavailable' : 'Not sent'}
        </p>
        {confirmationSent && <p className="mt-2 text-xs text-slate-500">{confirmationSentAt ? `Last sent ${formatHistoryDateTime(confirmationSentAt)}.` : 'Booking confirmation sent.'}</p>}
        <button type="button" className="mt-3 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={onSendConfirmation} disabled={!onSendConfirmation || requirements.loading || Boolean(requirements.error)}>{confirmationSent ? 'Send again' : 'Send confirmation'}</button>
      </Card>
    </aside>
  </div>;
};
export default BookingOverviewPanel;
