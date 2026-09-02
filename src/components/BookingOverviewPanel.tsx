import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiHeart, FiMail } from 'react-icons/fi';
import { paymentRequestsApi, paymentsApi } from '../services/api';
import { useBookingRequirements } from './useBookingRequirements';
import { bookingSettlementSummary, confirmationState, isActivePaymentRequest } from './bookingStatusSelectors';

const AlertIcon = FiAlertCircle as any; const HeartIcon = FiHeart as any; const MailIcon = FiMail as any;

export const formatBookingDate = (date?: string | Date) => { if (!date) return 'N/A'; const value = new Date(date); if (Number.isNaN(value.getTime())) return 'N/A'; return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
export const formatHistoryDateTime = (date?: string | Date) => { if (!date) return 'N/A'; const value = new Date(date); if (Number.isNaN(value.getTime())) return 'N/A'; return value.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
export const retreatTown = (retreat: any) => String(retreat?.location_town || retreat?.locationTown || retreat?.generalTown || retreat?.general_town || retreat?.house?.generalTown || retreat?.house?.general_town || retreat?.house?.city || retreat?.houseId?.generalTown || retreat?.houseId?.general_town || retreat?.houseId?.city || retreat?.location || '').trim();
export { sentConfirmationStep } from './bookingStatusSelectors';

type Props = { bookingId: string; booking: any; client: any; retreat: any; clientName: string; bookingTypeCode: string; retreatCode: string; retreatAddress: string; onEditClient: () => void; onBookingRefresh: () => void; onOpenTab?: (tab: 'payments' | 'requirements' | 'medical') => void; onSendConfirmation?: () => void; };
const objectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;
const dateValue = (retreat: any, edge: 'startDate' | 'endDate') => retreat?.[edge] || retreat?.dates?.[edge];
const daysUntil = (value: any) => { const date = new Date(value); if (Number.isNaN(date.getTime())) return null; return Math.ceil((date.getTime() - Date.now()) / 86400000); };
const money = (amount: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount || 0);

const BookingOverviewPanel: React.FC<Props> = ({ bookingId, booking, client, retreat, clientName, retreatCode, onEditClient, onBookingRefresh, onOpenTab, onSendConfirmation }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [totalUsd, setTotalUsd] = useState<number | null>(Number.isFinite(Number(booking?.totalAmountUsd)) ? Number(booking.totalAmountUsd) : null);
  const clientId = objectId(client); const retreatId = objectId(retreat);
  const requirements = useBookingRequirements({ bookingId, clientId, retreatId, refreshKey: 0 });
  useEffect(() => { let live = true; Promise.all([paymentsApi.getByBooking(bookingId), paymentRequestsApi.getByBooking(bookingId)]).then(([paid, requested]) => { if (live) { setPayments(paid.data || []); setRequests(requested.data || []); } }).catch(() => undefined); return () => { live = false; }; }, [bookingId]);
  const currency = booking.currency || 'EUR';
  const total = Number(booking.totalAmount || 0);
  useEffect(() => {
    if (Number.isFinite(Number(booking?.totalAmountUsd)) && Number(booking.totalAmountUsd) > 0) {
      setTotalUsd(Number(booking.totalAmountUsd));
      return;
    }
    let live = true;
    paymentsApi.convertToUsd(total, currency).then(response => {
      if (live) setTotalUsd(Number(response.data?.usd_amount));
    }).catch(() => { if (live) setTotalUsd(null); });
    return () => { live = false; };
  }, [booking?.totalAmountUsd, total, currency]);
  const settlement = bookingSettlementSummary(payments, total, currency, totalUsd);
  const { received, outstanding, overpaid, paidPercent, paidInFull, basis } = settlement;
  const settlementCurrency = basis === 'USD' ? 'USD' : currency;
  const confirmation = useMemo(() => confirmationState(booking, requirements.items), [booking, requirements.items]);
  const confirmationSent = confirmation.sent; const confirmationSentAt = confirmation.sentAt;
  const ekg = requirements.rows.find(row => row.key === 'ekg');
  const missingRows = requirements.rows.filter(row => row.required && !row.satisfied);
  const complete = Math.max(0, requirements.rows.length - missingRows.length);
  const start = dateValue(retreat, 'startDate'); const end = dateValue(retreat, 'endDate'); const startIn = daysUntil(start);
  const attention = [
    ...(outstanding > 0 && !requests.some(isActivePaymentRequest) ? [{ icon: <AlertIcon />, title: 'Balance not requested', detail: `${money(outstanding, settlementCurrency)} outstanding and no active payment request exists yet.`, badge: 'Blocking', action: 'Create request', tab: 'payments' as const }] : []),
    ...(ekg && !ekg.satisfied ? [{ icon: <HeartIcon />, title: 'Entry EKG not received', detail: 'Required before the medical cut-off.', badge: 'Action needed', action: 'Request file', tab: 'medical' as const }] : []),
    ...(!confirmationSent ? [{ icon: <MailIcon />, title: 'Confirmation not sent', detail: 'The client has not received a booking confirmation.', badge: 'Not sent', action: 'Send now' }] : []),
  ];
  const activities = [
    ...requirements.rows.filter(row => row.uploaded).slice(0, 3).map(row => ({ date: row.latestArtifact?.updatedAt || row.latestDocument?.updatedAt, text: `${row.label} received` })),
    ...(confirmationSentAt ? [{ date: confirmationSentAt, text: 'Confirmation sent' }] : []),
    { date: booking.registrationDate || booking.createdAt, text: 'Booking created' },
  ].filter(item => item.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  return <div className="booking-dashboard">
    <main className="booking-dashboard-main">
      <section className="overview-section"><header><h2>Needs attention</h2><span>{attention.length} thing{attention.length === 1 ? '' : 's'} waiting for you</span></header>{attention.length ? <div className="attention-list">{attention.map((item, index) => <article className="attention-item" key={item.title}><b>{String(index + 1).padStart(2, '0')}</b><i>{item.icon}</i><div><strong>{item.title}</strong><span>{item.detail}</span></div><em>{item.badge}</em><button type="button" onClick={() => 'tab' in item ? onOpenTab?.(item.tab!) : onSendConfirmation?.()}>{item.action}</button></article>)}</div> : <div className="overview-empty">Nothing needs attention.</div>}</section>
      <div className="overview-card-grid"><section className="overview-card money-card"><header><h3>Money</h3><button onClick={() => onOpenTab?.('payments')}>Payments tab</button></header><small>{basis === 'USD' ? 'USD booking price' : 'Total cost'}</small><strong>{money(basis === 'USD' ? Number(totalUsd) : total, settlementCurrency)}</strong>{basis === 'USD' && <small>{money(total, currency)} original price</small>}<div className="payment-progress"><span>{overpaid > 0.005 ? `Overpaid ${money(overpaid, settlementCurrency)}` : paidInFull ? 'Paid in full' : 'Not fully paid'}</span><div><i style={{ width: `${paidPercent}%` }} /></div><b>{paidPercent}%</b></div><footer><span>Received<b>{money(received, settlementCurrency)}</b></span><span>{overpaid > 0.005 ? 'Client credit' : 'Outstanding'}<b>{money(overpaid > 0.005 ? overpaid : outstanding, settlementCurrency)}</b></span></footer></section>
      <section className="overview-card requirements-card"><header><h3>Requirements</h3><button onClick={() => onOpenTab?.('requirements')}>All {requirements.rows.length}</button></header><strong>{complete} <small>/ {requirements.rows.length} done</small></strong><div className="requirement-segments">{requirements.rows.map(row => <i key={row.key} className={row.satisfied ? 'done' : row.required ? 'missing' : ''} />)}</div>{missingRows.slice(0, 3).map(row => <div className="requirement-next" key={row.key}><span>○</span><b>{row.label}</b><small>pending</small></div>)}</section></div>
      <section className="overview-retreat"><h3>Retreat</h3><div><b>{retreatCode}</b><strong>{formatBookingDate(start)} – {formatBookingDate(end)}</strong><span>{retreat?.name || retreatTown(retreat) || 'Retreat'}</span><em>{retreat?.capacity ? `${retreat.capacity} places` : ''}</em></div></section>
      <section className="overview-activity"><h3>Recent activity</h3>{activities.map((item, index) => <div key={`${item.text}-${index}`}><time>{formatHistoryDateTime(item.date)}</time><span>{item.text}</span></div>)}</section>
    </main>
    <aside className="booking-dashboard-rail"><section><header><h3>Client</h3><button onClick={onEditClient}>Edit</button></header><strong>{clientName}</strong><small>Email</small><a href={`mailto:${client?.email || ''}`}>{client?.email || 'N/A'}</a><small>Phone</small><span>{client?.phone || 'N/A'}</span><small>Country</small><span>{client?.country || 'N/A'}</span><div className="rail-actions"><a href={`mailto:${client?.email || ''}`}>Email</a><button onClick={onEditClient}>Client file</button></div></section>
    <section><h3>Confirmation</h3><em>{confirmationSent ? 'Sent' : 'Not sent'}</em><p>{confirmationSent ? (confirmationSentAt ? `Last sent ${formatHistoryDateTime(confirmationSentAt)}.` : 'Booking confirmation sent.') : 'The client has had no confirmation email for this booking.'}</p><button className="rail-primary" onClick={onSendConfirmation}>{confirmationSent ? 'Send again' : 'Send confirmation'}</button></section>
    <section><h3>Dates</h3><small>Retreat</small><span>{formatBookingDate(start)} – {formatBookingDate(end)}</span><small>Booked</small><span>{formatBookingDate(booking.registrationDate || booking.createdAt)}</span><small>Starts in</small><span>{startIn === null ? 'N/A' : `${startIn} days`}</span></section></aside>
  </div>;
};
export default BookingOverviewPanel;
