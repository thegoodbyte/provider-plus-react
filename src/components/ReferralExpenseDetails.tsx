import React from 'react';
import { Link } from 'react-router-dom';
import { RetreatExpense } from '../types';
export default function ReferralExpenseDetails({ expense, prefix }: { expense: RetreatExpense; prefix: string }) {
  if (!expense.referralPayoutItems?.length) return null;
  const partnerId = (typeof expense.referralId === 'object' ? expense.referralId?._id : expense.referralId) || expense.referralPayment?.referralId;
  return <section className="mt-4 rounded-xl border p-4" aria-label="Referral payment allocation">
    <h2 className="text-lg font-bold">Referral payment allocation</h2>
    <Link className="text-blue-700" to={`${prefix}/referrals?view=payments&referralId=${partnerId || ''}`}>referral · {expense.referralPayment?.referralCode || 'View payment history'}</Link>
    <p>{expense.referralPayment?.referralName || expense.vendor} · recorded by {expense.referralPayment?.recordedBy || 'not captured on legacy record'}</p>
    {expense.referralPayment?.voidedAt && <p className="mt-2 text-red-700">Voided record: {expense.referralPayment.voidReason}. Original amount {expense.referralPayment.originalAmount} {expense.currency}; expense total is now zero.</p>}
    {expense.referralPayoutItems.map(i => <div key={i.bookingId} className="mt-3 border-t pt-3"><Link to={`${prefix}/bookings/${i.bookingId}`}>Booking #{i.bookingNumber || '—'}</Link> · <Link to={`${prefix}/clients/${i.clientId}`}>{i.clientName || 'Client'}</Link><strong className="block">{i.amount} {i.currency}</strong></div>)}
  </section>;
}
