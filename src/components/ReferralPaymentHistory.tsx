import { formatCalendarDate } from '../utils/dateFormat';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { referralsApi } from '../services/api';
import { RetreatExpense } from '../types';

const id = (v: any) => typeof v === 'object' ? String(v?._id || '') : String(v || '');
const money = (n: number, c: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n);
export default function ReferralPaymentHistory({ prefix, initialReferral = '', onChanged }: { prefix: string; initialReferral?: string; onChanged?: () => Promise<void> }) {
  const [rows, setRows] = useState<RetreatExpense[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [referral, setReferral] = useState(initialReferral), [retreat, setRetreat] = useState(''), [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [busy, setBusy] = useState('');
  const load = async () => { setLoading(true); try { const r = await referralsApi.getPayouts(); setRows(r.data || []); setError(''); } catch (e: any) { setError(e?.response?.data?.message || 'Could not load referral payments.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  useEffect(() => { setReferral(initialReferral); }, [initialReferral]);
  const name = (e: RetreatExpense) => e.referralPayment?.referralName || e.vendor || (typeof e.referralId === 'object' && e.referralId ? e.referralId.name : '') || 'Unknown referral';
  const code = (e: RetreatExpense) => e.referralPayment?.referralCode || (typeof e.referralId === 'object' && e.referralId?.referralCode ? `${e.referralId.referralCode} · current code` : '') || '';
  const retreatName = (e: RetreatExpense) => e.referralPayment?.retreatCode || (typeof e.retreatId === 'object' && e.retreatId ? e.retreatId.code || e.retreatId.retreatCode || e.retreatId.name : id(e.retreatId || e.referralPayment?.retreatId));
  const filtered = useMemo(() => rows.filter(e => (!referral || id(e.referralId || e.referralPayment?.referralId) === referral) && (!retreat || id(e.retreatId || e.referralPayment?.retreatId) === retreat) && (status === 'all' || (status === 'voided' ? Boolean(e.referralPayment?.voidedAt) : e.status === 'paid')) && [name(e), code(e), retreatName(e), e.receiptNumber, e.paymentAccount, ...(e.referralPayoutItems || []).map(i => `${i.clientName} ${i.bookingNumber}`)].join(' ').toLowerCase().includes(query.trim().toLowerCase())), [rows, referral, retreat, query, status]);
  const totals = filtered.filter(e => e.status === 'paid').reduce<Record<string, number>>((s, e) => ({ ...s, [e.currency]: (s[e.currency] || 0) + e.amount }), {});
  const referrals = [...new Map(rows.map(e => [id(e.referralId || e.referralPayment?.referralId), `${code(e)} · ${name(e)}`])).entries()];
  const retreats = [...new Map(rows.map(e => [id(e.retreatId || e.referralPayment?.retreatId), retreatName(e)])).entries()];
  const voidRecord = async (e: RetreatExpense) => {
    const reason = window.prompt('Void this incorrect payment record? This does not refund money. Enter the correction reason:');
    if (!reason) return;
    setBusy(e._id!); try { await referralsApi.voidPayout(e._id!, reason); await load(); await onChanged?.(); } catch (err: any) { setError(err?.response?.data?.message || 'Could not void payment.'); } finally { setBusy(''); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Referral payment history">
    <h2 className="text-xl font-black">Referral payment history</h2>
    <p className="mb-4 text-sm text-slate-500">Recorded payments and their linked retreat expenses. Voided records remain visible for corrections.</p>
    <div className="mb-4 flex flex-wrap gap-2">
      <input aria-label="Search referral payments" placeholder="Referral code, client, booking or reference" value={query} onChange={e => setQuery(e.target.value)} className="min-h-11 rounded-lg border px-3" />
      <select aria-label="Payment referral" value={referral} onChange={e => setReferral(e.target.value)} className="min-h-11 rounded-lg border px-3"><option value="">All referrals</option>{referrals.map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
      <select aria-label="Payment retreat" value={retreat} onChange={e => setRetreat(e.target.value)} className="min-h-11 rounded-lg border px-3"><option value="">All retreats</option>{retreats.map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
      <select aria-label="Payment record status" value={status} onChange={e => setStatus(e.target.value)} className="min-h-11 rounded-lg border px-3"><option value="all">All records</option><option value="paid">Paid</option><option value="voided">Voided</option></select>
      <button onClick={() => void load()} className="min-h-11 rounded-lg border px-3">Refresh payments</button>
    </div>
    <div className="mb-4 flex flex-wrap gap-3">{Object.entries(totals).map(([c, n]) => <div key={c} className="rounded-lg bg-emerald-50 p-3"><span>Recorded paid · {c}</span><strong className="block text-xl">{money(n, c)}</strong></div>)}</div>
    {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    {loading ? <p role="status">Loading payments…</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="text-left"><th className="p-3">Paid to</th><th className="p-3">Date / recorded by</th><th className="p-3">Retreat / clients</th><th className="p-3">Amount</th><th className="p-3">Method / reference</th><th className="p-3">Expense</th></tr></thead><tbody>{filtered.map(e => <tr key={e._id} className="border-t align-top">
      <td className="p-3"><strong>{name(e)}</strong><div>referral · {code(e) || 'Code not recorded'}</div></td>
      <td className="p-3">{formatCalendarDate(e.expenseDate)}<div className="text-xs text-slate-500">{e.referralPayment?.recordedBy || 'Recorder not captured on legacy record'}</div></td>
      <td className="p-3"><Link to={`${prefix}/retreats/${id(e.retreatId || e.referralPayment?.retreatId)}`}>{retreatName(e)}</Link>{(e.referralPayoutItems || []).map(i => <div key={i.bookingId}><Link to={`${prefix}/bookings/${id(i.bookingId)}`}>#{i.bookingNumber || '—'} · {i.clientName}</Link> · {money(i.amount, i.currency)}</div>)}</td>
      <td className="p-3"><strong>{money(e.referralPayment?.originalAmount ?? e.amount, e.currency)}</strong><div>{e.referralPayment?.voidedAt ? 'Voided' : e.status}</div>{e.referralPayment?.voidedAt && <p className="text-xs">{e.referralPayment.voidReason} · {e.referralPayment.voidedBy}</p>}</td>
      <td className="p-3">{e.paymentMethod?.replace(/_/g, ' ')}<div>{e.paymentAccount}</div><div>{e.receiptNumber || 'No reference'}</div></td>
      <td className="p-3"><Link className="font-bold text-blue-700" to={`${prefix}/expenses/${e._id}`}>View expense</Link>{e.status === 'paid' && <button disabled={Boolean(busy)} onClick={() => void voidRecord(e)} className="mt-2 block rounded border px-2 py-1 text-red-700">{busy === e._id ? 'Voiding…' : 'Void incorrect record'}</button>}</td>
    </tr>)}</tbody></table>{!filtered.length && <p className="p-4">No referral payments match these filters.</p>}</div>}
  </section>;
}
