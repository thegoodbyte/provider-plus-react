import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { referralsApi } from '../services/api';
import { Referral, ReferralReportRow } from '../types';

const empty = { name: '', referralCode: '', defaultCommissionPercentage: 0, email: '', phone: '', notes: '', isActive: true };
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value || 0);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);

const ReferralsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/admin/') ? '/admin' : '';
  const [rows, setRows] = useState<Referral[]>([]);
  const [report, setReport] = useState<ReferralReportRow[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [selectedReferral, setSelectedReferral] = useState('');
  const [sort, setSort] = useState<'client' | 'retreat' | 'referral'>('referral');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [payoutRows, setPayoutRows] = useState<ReferralReportRow[]>([]);
  const [paying, setPaying] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ expenseDate: today(), paymentMethod: 'bank_transfer', paymentAccount: '', reference: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [list, detail] = await Promise.all([referralsApi.getAll(), referralsApi.getReport()]);
      setRows(list.data || []);
      setReport(detail.data || []);
      setSelectedBookings(new Set());
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load referrals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const reset = () => { setForm(empty); setEditingId(''); setError(''); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('Referral name is required.');
    if (!/^[A-Za-z]{2}$/.test(form.referralCode)) return setError('Referral code must contain exactly two letters.');
    try {
      editingId ? await referralsApi.update(editingId, form) : await referralsApi.create(form);
      reset();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save referral.');
    }
  };

  const filtered = useMemo(() => report
    .filter(row => !selectedReferral || row.referralId === selectedReferral)
    .sort((a, b) => {
      const av = sort === 'client' ? a.clientName : sort === 'retreat' ? a.retreatCode || a.retreatName || '' : a.referralName;
      const bv = sort === 'client' ? b.clientName : sort === 'retreat' ? b.retreatCode || b.retreatName || '' : b.referralName;
      return av.localeCompare(bv);
    }), [report, selectedReferral, sort]);
  const totals = useMemo(() => filtered.filter(row => !row.paid).reduce<Record<string, number>>((sum, row) => ({ ...sum, [row.owedCurrency]: (sum[row.owedCurrency] || 0) + row.amountOwed }), {}), [filtered]);
  const retreatTotals = useMemo(() => Object.values(filtered.filter(row => !row.paid).reduce<Record<string, { referralId: string; retreatId: string; label: string; currency: string; amount: number; rows: ReferralReportRow[] }>>((sum, row) => {
    const key = `${row.referralId}:${row.retreatId}:${row.owedCurrency}`;
    const current = sum[key] || { referralId: row.referralId, retreatId: row.retreatId, label: row.retreatCode || row.retreatName || 'Retreat', currency: row.owedCurrency, amount: 0, rows: [] };
    current.amount += row.amountOwed;
    current.rows.push(row);
    sum[key] = current;
    return sum;
  }, {})), [filtered]);
  const selectedName = rows.find(row => row._id === selectedReferral)?.name;
  const selectedRows = filtered.filter(row => selectedBookings.has(row.bookingId) && !row.paid);
  const startPayout = (items: ReferralReportRow[]) => {
    const outstanding = items.filter(item => !item.paid);
    if (!outstanding.length) return;
    const groupKeys = new Set(outstanding.map(item => `${item.referralId}:${item.retreatId}:${item.owedCurrency}`));
    if (groupKeys.size !== 1) return setError('Select commissions for one referral, one retreat and one currency per payment.');
    setError('');
    setPayoutRows(outstanding);
    setPayoutForm({ expenseDate: today(), paymentMethod: 'bank_transfer', paymentAccount: '', reference: '', notes: '' });
  };
  const submitPayout = async (event: FormEvent) => {
    event.preventDefault();
    if (!payoutRows.length) return;
    setPaying(true);
    try {
      await referralsApi.createPayout({ referralId: payoutRows[0].referralId, retreatId: payoutRows[0].retreatId, bookingIds: payoutRows.map(row => row.bookingId), ...payoutForm });
      setPayoutRows([]);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not record the referral payment.');
    } finally {
      setPaying(false);
    }
  };

  return <div className="mx-auto max-w-7xl p-4">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-3xl font-black text-slate-950">Referrals</h1><p className="text-slate-500">Manage referral partners and see every client and retreat attributed to them.</p></div>
      {selectedReferral && <button type="button" onClick={() => setSelectedReferral('')} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-700">Show all referrals</button>}
    </div>
    {error && <div className="mb-4 rounded-xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}

    <form onSubmit={save} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{editingId ? 'Edit referral' : 'Add referral'}</h2>{editingId && <button type="button" onClick={reset} aria-label="Cancel editing"><X size={20} /></button>}</div>
      <div className="grid gap-3 md:grid-cols-5">
        <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Name *" className="min-h-12 rounded-xl border border-slate-300 px-3" required />
        <input value={form.referralCode} maxLength={2} onChange={event => setForm({ ...form, referralCode: event.target.value.replace(/[^a-z]/gi, '').toUpperCase() })} placeholder="Code (AD) *" className="min-h-12 rounded-xl border border-slate-300 px-3 uppercase" required />
        <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="Email" className="min-h-12 rounded-xl border border-slate-300 px-3" />
        <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Phone" className="min-h-12 rounded-xl border border-slate-300 px-3" />
        <label className="text-sm font-semibold text-slate-700">Commission %<input type="number" min="0" max="100" step="0.01" value={form.defaultCommissionPercentage} onChange={event => setForm({ ...form, defaultCommissionPercentage: Number(event.target.value) })} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base font-normal" /></label>
      </div>
      <textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Notes" className="mt-3 min-h-20 w-full rounded-xl border border-slate-300 p-3" />
      <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
      <button className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white"><Plus size={19} />{editingId ? 'Save changes' : 'Add referral'}</button>
    </form>

    <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => {
        const count = report.filter(item => item.referralId === row._id).length;
        const selected = selectedReferral === row._id;
        return <div key={row._id} role="button" tabIndex={0} onClick={() => setSelectedReferral(selected ? '' : row._id || '')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedReferral(selected ? '' : row._id || ''); }} className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-black text-blue-800">{row.referralCode || initials(row.name) || '--'}</span>
          <div className="min-w-0 flex-1"><div className="font-bold text-slate-950">{row.name} {row.isActive === false && <span className="text-xs text-slate-400">Inactive</span>}</div><div className="text-sm text-slate-500">{Number(row.defaultCommissionPercentage || 0)}% commission · {count} booking{count === 1 ? '' : 's'}</div></div>
          <button type="button" aria-label={`Edit ${row.name}`} onClick={event => { event.stopPropagation(); setEditingId(row._id || ''); setForm({ name: row.name, referralCode: row.referralCode || initials(row.name).slice(0, 2), defaultCommissionPercentage: Number(row.defaultCommissionPercentage || 0), email: row.email || '', phone: row.phone || '', notes: row.notes || '', isActive: row.isActive !== false }); }} className="rounded-lg p-2 hover:bg-slate-100"><Pencil size={18} /></button>
          <button type="button" aria-label={`Delete ${row.name}`} onClick={async event => { event.stopPropagation(); if (row._id && window.confirm(`Delete referral “${row.name}”?`)) { await referralsApi.delete(row._id); if (selectedReferral === row._id) setSelectedReferral(''); await load(); } }} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
          <ChevronRight className={`text-slate-400 transition ${selected ? 'rotate-90' : ''}`} size={20} />
        </div>;
      })}
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black">{selectedName ? `Clients referred by ${selectedName}` : 'Referred clients'}</h2><p className="text-sm text-slate-500">Non-cancelled bookings. Amount owed uses the referral commission percentage.</p></div>
        <div className="flex flex-wrap gap-2">{selectedRows.length > 0 && <button type="button" onClick={() => startPayout(selectedRows)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 font-bold text-white"><Wallet size={17} />Pay selected ({selectedRows.length})</button>}<select aria-label="Filter by referral" value={selectedReferral} onChange={event => { setSelectedReferral(event.target.value); setSelectedBookings(new Set()); }} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="">All referrals</option>{rows.map(row => <option key={row._id} value={row._id}>{row.referralCode ? `${row.referralCode} · ` : ''}{row.name}</option>)}</select><select aria-label="Sort referred clients" value={sort} onChange={event => setSort(event.target.value as any)} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="referral">Sort by referral</option><option value="client">Sort by client</option><option value="retreat">Sort by retreat</option></select></div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(totals).map(([currency, total]) => <div key={currency} className="rounded-xl bg-emerald-50 px-4 py-3"><div className="text-xs font-bold uppercase text-emerald-700">Total owed</div><div className="text-xl font-black text-emerald-950">{money(total, currency)}</div></div>)}
        {selectedReferral && retreatTotals.map(item => <div key={`${item.referralId}-${item.retreatId}-${item.currency}`} className="flex items-center gap-4 rounded-xl bg-slate-100 px-4 py-3"><div><div className="text-xs font-bold uppercase text-slate-500">{item.label}</div><div className="font-black">{money(item.amount, item.currency)} · {item.rows.length} item{item.rows.length === 1 ? '' : 's'}</div></div><button type="button" onClick={() => startPayout(item.rows)} className="ml-auto min-h-9 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white">Pay retreat</button></div>)}
      </div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="w-10 p-3"><span className="sr-only">Select</span></th><th className="p-3">Client</th><th className="p-3">Retreat</th><th className="p-3">Referral</th><th className="p-3">Booking</th><th className="p-3 text-right">Commission</th><th className="p-3">Payment</th></tr></thead><tbody className="divide-y divide-slate-200">{filtered.map(row => <tr key={row.bookingId} className={row.paid ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}><td className="p-3"><input type="checkbox" aria-label={`Select commission for booking ${row.bookingNumber || row.bookingId}`} checked={selectedBookings.has(row.bookingId)} disabled={row.paid} onChange={event => setSelectedBookings(current => { const next = new Set(current); event.target.checked ? next.add(row.bookingId) : next.delete(row.bookingId); return next; })} /></td><td className="p-3"><button type="button" onClick={() => navigate(`${routePrefix}/clients/${row.clientId}`)} className="text-left font-bold text-slate-950 hover:text-blue-700 hover:underline">{row.clientName}</button><div className="text-xs text-slate-500">Client #{row.clientDisplayId || '—'} · {row.clientEmail || 'No email'}</div></td><td className="p-3 font-semibold">{row.retreatCode || row.retreatName || '—'}</td><td className="p-3"><span className="mr-2 rounded bg-blue-100 px-2 py-1 font-black text-blue-800">{row.referralCode || initials(row.referralName) || '--'}</span>{row.referralName}</td><td className="p-3"><button type="button" onClick={() => navigate(`${routePrefix}/bookings/${row.bookingId}`)} className="hover:text-blue-700 hover:underline">#{row.bookingNumber || '—'} · {row.commissionPercentage}%</button></td><td className="p-3 text-right font-black">{money(row.amountOwed, row.owedCurrency)}</td><td className="p-3">{row.paid && row.expenseId ? <div><button type="button" onClick={() => navigate(`${routePrefix}/expenses/${row.expenseId}`)} className="font-bold text-emerald-700 hover:underline">Paid · view expense</button><div className="text-xs text-slate-500">{row.paidAt ? new Date(row.paidAt).toLocaleDateString() : ''}</div></div> : <button type="button" onClick={() => startPayout([row])} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">Pay</button>}</td></tr>)}{!filtered.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">{loading ? 'Loading referred bookings…' : 'No referred bookings found.'}</td></tr>}</tbody></table></div>
    </section>

    {payoutRows.length > 0 && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="referral-payout-title">
      <form onSubmit={submitPayout} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between"><div><h2 id="referral-payout-title" className="text-xl font-black">Record referral payment</h2><p className="text-sm text-slate-500">{payoutRows[0].referralName} · {payoutRows[0].retreatCode || payoutRows[0].retreatName} · {payoutRows.length} commission item{payoutRows.length === 1 ? '' : 's'}</p></div><button type="button" onClick={() => setPayoutRows([])} aria-label="Close payout"><X /></button></div>
        <div className="mb-4 rounded-xl bg-emerald-50 p-4"><div className="text-xs font-bold uppercase text-emerald-700">Payment total</div><div className="text-2xl font-black text-emerald-950">{money(payoutRows.reduce((sum, row) => sum + row.amountOwed, 0), payoutRows[0].owedCurrency)}</div></div>
        <div className="mb-4 max-h-44 overflow-y-auto rounded-xl border border-slate-200">{payoutRows.map(row => <div key={row.bookingId} className="flex justify-between gap-3 border-b border-slate-100 p-3 last:border-0"><div><strong>{row.clientName}</strong><div className="text-xs text-slate-500">Booking #{row.bookingNumber || '—'} · {row.commissionPercentage}%</div></div><strong>{money(row.amountOwed, row.owedCurrency)}</strong></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Payment date<input type="date" value={payoutForm.expenseDate} onChange={event => setPayoutForm({ ...payoutForm, expenseDate: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" required /></label><label className="text-sm font-bold">Payment method<select value={payoutForm.paymentMethod} onChange={event => setPayoutForm({ ...payoutForm, paymentMethod: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label><label className="text-sm font-bold">Account<input value={payoutForm.paymentAccount} onChange={event => setPayoutForm({ ...payoutForm, paymentAccount: event.target.value })} placeholder="Revolut, CSOB…" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-bold">Reference<input value={payoutForm.reference} onChange={event => setPayoutForm({ ...payoutForm, reference: event.target.value })} placeholder="Transfer reference" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label></div>
        <label className="mt-3 block text-sm font-bold">Notes<textarea value={payoutForm.notes} onChange={event => setPayoutForm({ ...payoutForm, notes: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3" placeholder="Optional payout notes" /></label>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPayoutRows([])} className="min-h-11 rounded-lg border border-slate-300 px-4 font-bold">Cancel</button><button type="submit" disabled={paying} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50"><Wallet size={17} />{paying ? 'Recording…' : 'Record paid expense'}</button></div>
      </form>
    </div>}
  </div>;
};

export default ReferralsPage;
