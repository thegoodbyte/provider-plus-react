import React, { useMemo } from 'react';
import BookingPaymentManagement from './BookingPaymentManagement';
import { useBookingRequirements } from './useBookingRequirements';
import { confirmationState } from './bookingStatusSelectors';
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
const daysUntil = (value: any) => { const date = new Date(value); if (Number.isNaN(date.getTime())) return null; return Math.ceil((date.getTime() - Date.now()) / 86400000); };
const OverviewSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <details className="booking-overview-disclosure">
  <summary><span>{title}</span><span aria-hidden="true" className="overview-show">Show</span><span aria-hidden="true" className="overview-hide">Hide</span></summary>
  <div className="booking-overview-disclosure-body">{children}</div>
</details>;

const BookingOverviewPanel: React.FC<Props> = ({ bookingId, booking, client, retreat, clientName, retreatCode, retreatAddress, onEditClient, onBookingRefresh, onOpenTab, onSendConfirmation, refreshKey = 0 }) => {
  const clientId = objectId(client); const retreatId = objectId(retreat);
  const requirements = useBookingRequirements({ bookingId, clientId, retreatId, refreshKey });
  const confirmation = useMemo(() => confirmationState(booking, requirements.items), [booking, requirements.items]);
  const confirmationSent = confirmation.sent; const confirmationSentAt = confirmation.sentAt;
  const missingRows = requirements.rows.filter(row => row.required && !row.satisfied);
  const start = dateValue(retreat, 'startDate', booking); const end = dateValue(retreat, 'endDate', booking);
  const startTime = timeValue(retreat, 'startTime', booking); const endTime = timeValue(retreat, 'endTime', booking);
  const startIn = daysUntil(start);
  const checkIn = booking?.bookingType === BookingType.BOOSTER ? start : booking?.checkInDate || start;
  const checkOut = booking?.bookingType === BookingType.BOOSTER ? end : booking?.checkOutDate || end;
  return <div className="booking-overview-layout" aria-label="Booking overview">
    <main className="booking-overview-main">
      <section className="booking-overview-payments" aria-label="Booking payments">
        <BookingPaymentManagement bookingId={bookingId} bookingNumber={booking.bookingNumber} clientName={clientName} bookingHash={booking.bookingHash}
          clientId={clientId} retreatId={retreatId} totalAmount={booking.totalAmount || 0} currency={booking.currency || 'EUR'} pricingSummary={booking.pricingSummary} onPaymentUpdate={onBookingRefresh} />
      </section>
      <OverviewSection title="Requirements next up">
        {requirements.loading ? <p role="status">Loading booking requirements…</p> : requirements.error ? <div role="alert"><p>{requirements.error}</p><button type="button" onClick={requirements.reload}>Retry requirements</button></div> : <>
          {missingRows.length ? <><p>{missingRows.length} required {missingRows.length === 1 ? 'item needs' : 'items need'} attention.</p><ul>{missingRows.slice(0,5).map(row=><li key={row.key}>{row.label}</li>)}</ul></> : <p>No outstanding required items.</p>}
          <button type="button" className="booking-overview-text-action" onClick={()=>onOpenTab?.('requirements')}>Open all requirements</button>
        </>}
      </OverviewSection>
      <OverviewSection title="Retreat information">
        <dl className="booking-overview-fields"><div><dt>Retreat</dt><dd>{retreatCode || 'N/A'} · {retreat?.name || retreatTown(retreat) || 'Retreat'}</dd></div>
          <div><dt>Address</dt><dd>{retreatAddress || retreatTown(retreat) || 'N/A'}</dd></div>
          <div><dt>{booking?.bookingType === BookingType.BOOSTER ? 'Booster booking' : 'Retreat dates'}</dt><dd>{formatBookingDate(start)}{startTime ? ` · ${startTime}` : ''} – {formatBookingDate(end)}{endTime ? ` · ${endTime}` : ''}</dd></div>
          {retreat?.capacity && <div><dt>Capacity</dt><dd>{retreat.capacity} places</dd></div>}
        </dl>
      </OverviewSection>
      <OverviewSection title="Booking dates">
        <dl className="booking-overview-fields"><div><dt>Check-in</dt><dd>{formatBookingDate(checkIn)}{startTime ? ` · ${startTime}` : ''}</dd></div><div><dt>Check-out</dt><dd>{formatBookingDate(checkOut)}{endTime ? ` · ${endTime}` : ''}</dd></div>
          <div><dt>Booked</dt><dd>{formatBookingDate(booking.registrationDate || booking.createdAt)}</dd></div></dl>
      </OverviewSection>
    </main>
    <aside className="booking-dashboard-rail booking-overview-aside" aria-label="Booking client summary"><section><header><h3>Client</h3><button type="button" onClick={onEditClient}>Edit</button></header><strong>{clientName}</strong><small>Email</small>{client?.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : <span>N/A</span>}<small>Phone</small><span>{client?.phone || 'N/A'}</span><small>Country</small><span>{client?.country || 'N/A'}</span>
      <small>Referral</small><span>{(typeof client?.referralId === 'object' ? client.referralId?.name : '') || client?.source || 'N/A'}{client?.referralAttributionType && client.referralAttributionType !== 'na' ? ` · ${client.referralAttributionType === 'direct' ? 'Direct' : 'Self-identified'}` : ''}</span>
      <small>Accommodation</small><span>{booking?.roomType === 'private_ensuite' ? 'Private room, private bathroom' : booking?.roomType === 'private' ? 'Private room' : booking?.roomType === 'shared' ? 'Shared room' : 'Not decided'}{booking?.roomNumber ? ` · ${booking.roomNumber}` : ''}</span>
    </section>
    <section><h3>Confirmation</h3><em>{confirmationSent ? 'Sent' : requirements.loading ? 'Checking…' : requirements.error ? 'Status unavailable' : 'Not sent'}</em>
      {confirmationSent && <p>{confirmationSentAt ? `Last sent ${formatHistoryDateTime(confirmationSentAt)}.` : 'Booking confirmation sent.'}</p>}
      <button type="button" className="rail-primary" onClick={onSendConfirmation} disabled={!onSendConfirmation || requirements.loading || Boolean(requirements.error)}>{confirmationSent ? 'Send again' : 'Send confirmation'}</button>
    </section>
    <section><h3>Dates</h3><small>{booking?.bookingType === BookingType.BOOSTER ? 'Booster' : 'Retreat'}</small><span>{formatBookingDate(start)} – {formatBookingDate(end)}</span><small>Booked</small><span>{formatBookingDate(booking.registrationDate || booking.createdAt)}</span><small>Starts in</small><span>{startIn === null ? 'N/A' : startIn < 0 ? `Started ${Math.abs(startIn)} days ago` : `${startIn} days`}</span></section></aside>
  </div>;
};
export default BookingOverviewPanel;
