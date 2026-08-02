import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { referralsApi } from '../services/api';
import { Referral, ReferralReportRow } from '../types';

const empty = { name: '', referralCode: '', defaultCommissionPercentage: 0, email: '', phone: '', notes: '', isActive: true };
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value || 0);

const ReferralsPage: React.FC = () => {
  const [rows, setRows] = useState<Referral[]>([]);
  const [report, setReport] = useState<ReferralReportRow[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [selectedReferral, setSelectedReferral] = useState('');
  const [sort, setSort] = useState<'client' | 'retreat' | 'referral'>('referral');
  const [error, setError] = useState('');
  const load = async () => {
    try { const [list, detail] = await Promise.all([referralsApi.getAll(), referralsApi.getReport()]); setRows(list.data || []); setReport(detail.data || []); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not load referrals.'); }
  };
  useEffect(() => { void load(); }, []);
  const reset = () => { setForm(empty); setEditingId(''); setError(''); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('Referral name is required.');
    if (!/^[A-Za-z]{2}$/.test(form.referralCode)) return setError('Referral code must contain exactly two letters.');
    try { editingId ? await referralsApi.update(editingId, form) : await referralsApi.create(form); reset(); await load(); }
    catch (e: any) { setError(e?.response?.data?.message || 'Could not save referral.'); }
  };
  const filtered = useMemo(() => report.filter(row => !selectedReferral || row.referralId === selectedReferral).sort((a,b) => {
    const av = sort === 'client' ? a.clientName : sort === 'retreat' ? a.retreatCode || a.retreatName || '' : a.referralName;
    const bv = sort === 'client' ? b.clientName : sort === 'retreat' ? b.retreatCode || b.retreatName || '' : b.referralName;
    return av.localeCompare(bv);
  }), [report, selectedReferral, sort]);
  const totals = useMemo(() => filtered.reduce<Record<string, number>>((sum,row) => ({...sum,[row.owedCurrency]:(sum[row.owedCurrency]||0)+row.amountOwed}), {}), [filtered]);
  const retreatTotals = useMemo(() => Object.values(filtered.reduce<Record<string,{label:string;currency:string;amount:number}>>((sum,row) => { const key=`${row.retreatId}:${row.owedCurrency}`; const current=sum[key]||{label:row.retreatCode||row.retreatName||'Retreat',currency:row.owedCurrency,amount:0}; current.amount+=row.amountOwed; sum[key]=current; return sum; },{})), [filtered]);

  return <div className="mx-auto max-w-7xl p-4">
    <div className="mb-5"><h1 className="text-3xl font-black text-slate-950">Referrals</h1><p className="text-slate-500">Manage referral partners and see every client and retreat attributed to them.</p></div>
    {error && <div className="mb-4 rounded-xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}
    <form onSubmit={save} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{editingId?'Edit referral':'Add referral'}</h2>{editingId&&<button type="button" onClick={reset}><X/></button>}</div>
      <div className="grid gap-3 md:grid-cols-5"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Name *" className="min-h-12 rounded-xl border px-3" required/><input value={form.referralCode} maxLength={2} onChange={e=>setForm({...form,referralCode:e.target.value.replace(/[^a-z]/gi,'').toUpperCase()})} placeholder="Code (AD) *" className="min-h-12 rounded-xl border px-3 uppercase" required/><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email" className="min-h-12 rounded-xl border px-3"/><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Phone" className="min-h-12 rounded-xl border px-3"/><label className="text-sm font-semibold">Commission %<input type="number" min="0" max="100" step="0.01" value={form.defaultCommissionPercentage} onChange={e=>setForm({...form,defaultCommissionPercentage:Number(e.target.value)})} className="mt-1 min-h-12 w-full rounded-xl border px-3 text-base font-normal"/></label></div>
      <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Notes" className="mt-3 min-h-20 w-full rounded-xl border p-3"/><label className="mt-3 flex gap-2"><input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form,isActive:e.target.checked})}/>Active</label><button className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white"><Plus size={19}/>{editingId?'Save changes':'Add referral'}</button>
    </form>
    <div className="mb-6 grid gap-3 md:grid-cols-2">{rows.map(row=><div key={row._id} className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 font-black text-blue-800">{row.referralCode||'--'}</span><div className="min-w-0 flex-1"><div className="font-bold">{row.name}</div><div className="text-sm text-slate-500">{row.defaultCommissionPercentage||0}% commission · {report.filter(item=>item.referralId===row._id).length} bookings</div></div><button onClick={()=>{setEditingId(row._id||'');setForm({name:row.name,referralCode:row.referralCode||'',defaultCommissionPercentage:Number(row.defaultCommissionPercentage||0),email:row.email||'',phone:row.phone||'',notes:row.notes||'',isActive:row.isActive!==false});}} className="p-2"><Pencil size={18}/></button><button onClick={async()=>{if(row._id&&window.confirm(`Delete referral “${row.name}”?`)){await referralsApi.delete(row._id);await load();}}} className="p-2 text-red-600"><Trash2 size={18}/></button></div>)}</div>
    <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Referred clients</h2><p className="text-sm text-slate-500">Non-cancelled bookings. Amount owed uses the referral’s base commission percentage.</p></div><div className="flex gap-2"><select value={selectedReferral} onChange={e=>setSelectedReferral(e.target.value)} className="min-h-11 rounded-xl border px-3"><option value="">All referrals</option>{rows.map(row=><option key={row._id} value={row._id}>{row.referralCode?`${row.referralCode} · `:''}{row.name}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value as any)} className="min-h-11 rounded-xl border px-3"><option value="referral">Sort by referral</option><option value="client">Sort by client</option><option value="retreat">Sort by retreat</option></select></div></div>
      <div className="mb-4 flex flex-wrap gap-3">{Object.entries(totals).map(([currency,total])=><div key={currency} className="rounded-xl bg-emerald-50 px-4 py-3"><div className="text-xs font-bold uppercase text-emerald-700">Total owed</div><div className="text-xl font-black text-emerald-950">{money(total,currency)}</div></div>)}{selectedReferral&&retreatTotals.map(item=><div key={`${item.label}-${item.currency}`} className="rounded-xl bg-slate-100 px-4 py-3"><div className="text-xs font-bold uppercase text-slate-500">{item.label}</div><div className="font-black">{money(item.amount,item.currency)}</div></div>)}</div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="p-3">Client</th><th className="p-3">Retreat</th><th className="p-3">Referral</th><th className="p-3">Booking</th><th className="p-3 text-right">Owed</th></tr></thead><tbody className="divide-y">{filtered.map(row=><tr key={row.bookingId}><td className="p-3"><div className="font-bold">{row.clientName}</div><div className="text-xs text-slate-500">Client #{row.clientDisplayId||'—'} · {row.clientEmail||'No email'}</div></td><td className="p-3 font-semibold">{row.retreatCode||row.retreatName||'—'}</td><td className="p-3"><span className="mr-2 rounded bg-blue-100 px-2 py-1 font-black text-blue-800">{row.referralCode||'--'}</span>{row.referralName}</td><td className="p-3">#{row.bookingNumber||'—'} · {row.commissionPercentage}%</td><td className="p-3 text-right font-black">{money(row.amountOwed,row.owedCurrency)}</td></tr>)}{!filtered.length&&<tr><td colSpan={5} className="p-8 text-center text-slate-500">No referred bookings found.</td></tr>}</tbody></table></div>
    </section>
  </div>;
};
export default ReferralsPage;
