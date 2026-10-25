import React from 'react';
import { Link } from 'react-router-dom';
import { Payment } from '../types';
import CurrencyDisplay from './CurrencyDisplay';
import { formatCalendarDate } from '../utils/dateFormat';
const label = (value?: string) => value ? value.replace(/_/g, ' ') : '—';
export default function PaymentDetailSummary({ payment, client, booking, retreat, request }: { payment: Payment; client?: any; booking?: any; retreat?: any; request?: any }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Client', client ? <Link to={`/admin/clients/${client._id}`} className="text-blue-700 underline">{[client.firstName, client.lastName].filter(Boolean).join(' ') || 'Client'}{client.display_id ? ` · #${client.display_id}` : ''}</Link> : 'Client details unavailable'],
    ['Received date', formatCalendarDate(payment.paymentDate)], ['Status', label(payment.status)], ['Payment method', label(payment.paymentMethod)],
    ['Booking', booking ? <Link to={`/admin/bookings/${booking._id}`} className="text-blue-700 underline">Booking #{booking.bookingNumber || '—'}</Link> : 'No booking linked'],
    ['Retreat', retreat ? [retreat.name, retreat.retreatCode || retreat.code].filter(Boolean).join(' · ') : 'No retreat linked'],
    ['Payment request', request ? <Link to={`/admin/payment-requests/${request._id}`} className="text-blue-700 underline">Request #{request.invoiceNumber || request.display_id || '—'}</Link> : 'No payment request linked'],
    ['Payment type', label(payment.paymentType)], ['Transaction ID', payment.transactionId || '—'],
    ['Deposit', payment.isDeposit ? 'Yes' : 'No'], ['Final payment', payment.isFinalPayment ? 'Yes' : 'No'], ['Refundable', payment.isRefundable ? 'Yes' : 'No'],
    ['Purpose', payment.description || '—'], ['Internal notes', payment.notes || '—'],
  ];
  const p: any = payment;
  if (p.requestCurrencyAmount != null) rows.push(['Payment request equivalent', `${p.requestCurrencyAmount} ${request?.currency || ''}`]);
  if (p.bookingCurrencyAmount != null) rows.push(['Booking equivalent', `${p.bookingCurrencyAmount} ${booking?.currency || ''}`]);
  if (p.refundedAmount) rows.push(['Refunded amount', `${p.refundedAmount} ${payment.currency}`]);
  return <section aria-label="Payment details" className="min-w-0"><div className="mb-6 rounded-xl bg-blue-50 p-5"><p className="text-sm font-semibold text-blue-800">Payment #{payment.display_id || '—'}</p><div className="mt-2 text-3xl font-bold text-gray-950"><CurrencyDisplay amount={payment.amount} currency={payment.currency}/></div>{p.allocationCount > 1 && <p className="mt-2 text-sm text-blue-900">Allocation {p.allocationIndex || '—'} of {p.allocationCount} · shared receipt total {p.transactionTotalAmount} {payment.currency}</p>}</div><dl className="grid min-w-0 gap-x-8 gap-y-5 sm:grid-cols-2">{rows.map(([name, value]) => <div key={name} className="min-w-0 border-b border-gray-100 pb-3"><dt className="text-sm font-medium text-gray-500">{name}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-semibold text-gray-900">{value}</dd></div>)}</dl></section>;
}
