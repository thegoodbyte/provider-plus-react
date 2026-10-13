import { newRequestId } from '../utils/requestId';
import ReferralPaymentHistory from './ReferralPaymentHistory';
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { referralsApi } from '../services/api';
import { ReferralPackagesEditor } from './ReferralPackagesEditor';
import { ReferralPortalAccountEditor } from './ReferralPortalAccountEditor';
import { ReferralCommissionPackage, Referral, ReferralRateRule, ReferralReportRow } from '../types';

const emptyRule = (): ReferralRateRule => ({ effectiveFrom: today(), effectiveTo: '', tiers: [{ minPrice: 0, ratePercent: 0 }], notes: '' });
const empty = { name: '', referralCode: '', defaultCommissionPercentage: 0, influenceCommissionPercentage: '' as number | '', allowRepeatBookingCredit: true, email: '', phone: '', notes: '', isActive: true, rateSchedule: [] as ReferralRateRule[], commissionPackages: [] as ReferralCommissionPackage[] };
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value || 0);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');
function today() { return new Date().toISOString().slice(0, 10); }

const ReferralsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/admin/') ? '/admin' : '';
  const [rows, setRows] = useState<Referral[]>([]);
  const [report, setReport] = useState<ReferralReportRow[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [selectedReferral, setSelectedReferral] = useState(new URLSearchParams(location.search).get('referralId') || '');
  const [view, setView] = useState(new URLSearchParams(location.search).get('view') === 'payments' ? 'payments' : 'commissions');
  const [payoutRequestId, setPayoutRequestId] = useState('');
  const [selectedRetreat, setSelectedRetreat] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'client' | 'retreat' | 'referral'>('referral');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const editorRef = useRef<HTMLFormElement>(null);
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
  const reset = () => { setForm(empty); setEditingId(''); setError(''); setSavedMessage(''); };
  const addRule = () => setForm(current => ({ ...current, rateSchedule: [...(current.rateSchedule || []), emptyRule()] }));
  const removeRule = (index: number) => setForm(current => ({ ...current, rateSchedule: (current.rateSchedule || []).filter((_, i) => i !== index) }));
  const updateRule = (index: number, patch: Partial<ReferralRateRule>) => setForm(current => ({
    ...current, rateSchedule: (current.rateSchedule || []).map((rule, i) => i === index ? { ...rule, ...patch } : rule),
  }));
  const addTier = (ruleIndex: number) => updateRule(ruleIndex, { tiers: [...(form.rateSchedule[ruleIndex]?.tiers || []), { minPrice: 0, ratePercent: 0 }] });
  const removeTier = (ruleIndex: number, tierIndex: number) => updateRule(ruleIndex, { tiers: (form.rateSchedule[ruleIndex]?.tiers || []).filter((_, i) => i !== tierIndex) });
  const updateTier = (ruleIndex: number, tierIndex: number, patch: Partial<{ minPrice: number; ratePercent: number }>) => updateRule(ruleIndex, {
    tiers: (form.rateSchedule[ruleIndex]?.tiers || []).map((tier, i) => i === tierIndex ? { ...tier, ...patch } : tier),
  });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSavedMessage('');
    if (!form.name.trim()) return setError('Referral name is required.');
    if (!/^[A-Za-z]{2}$/.test(form.referralCode)) return setError('Referral code must contain exactly two letters.');
    setSaving(true);
    setError('');
    try {
      const response = editingId ? await referralsApi.update(editingId, { ...form, influenceCommissionPercentage: form.influenceCommissionPercentage === '' ? null : form.influenceCommissionPercentage }) : await referralsApi.create({ ...form, influenceCommissionPercentage: form.influenceCommissionPercentage === '' ? null : form.influenceCommissionPercentage });
      if (!editingId && response.data?._id) setEditingId(response.data._id);
      await load();
      setSavedMessage('Referral saved. Rate schedule and commission packages are saved together.');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save referral.');
    } finally {
      setSaving(false);
    }
  };

  const retreatOptions = useMemo(() => Object.values(report.reduce<Record<string, { id: string; label: string }>>((sum, row) => {
    sum[row.retreatId] = sum[row.retreatId] || { id: row.retreatId, label: row.retreatCode || row.retreatName || 'Retreat' };
    return sum;
  }, {})).sort((a, b) => a.label.localeCompare(b.label)), [report]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return report
      .filter(row => !selectedReferral || row.referralId === selectedReferral)
      .filter(row => !selectedRetreat || row.retreatId === selectedRetreat)
      .filter(row => !query || [row.clientName, row.referralName, row.referredByLabel].filter(Boolean).some(value => String(value).toLowerCase().includes(query)))
      .sort((a, b) => {
        const av = sort === 'client' ? a.clientName : sort === 'retreat' ? a.retreatCode || a.retreatName || '' : a.referralName;
        const bv = sort === 'client' ? b.clientName : sort === 'retreat' ? b.retreatCode || b.retreatName || '' : b.referralName;
        return av.localeCompare(bv);
      });
  }, [report, selectedReferral, selectedRetreat, search, sort]);
  const totals = useMemo(() => filtered.filter(row => !row.paid && !row.commissionIssue).reduce<Record<string, number>>((sum, row) => ({ ...sum, [row.owedCurrency]: (sum[row.owedCurrency] || 0) + row.amountOwed }), {}), [filtered]);
  const retreatTotals = useMemo(() => Object.values(filtered.filter(row => !row.paid && !row.commissionIssue).reduce<Record<string, { referralId: string; retreatId: string; label: string; currency: string; amount: number; rows: ReferralReportRow[] }>>((sum, row) => {
    const key = `${row.referralId}:${row.retreatId}:${row.owedCurrency}`;
    const current = sum[key] || { referralId: row.referralId, retreatId: row.retreatId, label: row.retreatCode || row.retreatName || 'Retreat', currency: row.owedCurrency, amount: 0, rows: [] };
    current.amount += row.amountOwed;
    current.rows.push(row);
    sum[key] = current;
    return sum;
  }, {})), [filtered]);
  const selectedName = rows.find(row => row._id === selectedReferral)?.name;
  const selectedRows = filtered.filter(row => selectedBookings.has(row.bookingId) && !row.paid && !row.commissionIssue);
  const startPayout = (items: ReferralReportRow[]) => {
    const outstanding = items.filter(item => !item.paid && !item.commissionIssue);
    if (!outstanding.length) return;
    const groupKeys = new Set(outstanding.map(item => `${item.referralId}:${item.retreatId}:${item.owedCurrency}`));
    if (groupKeys.size !== 1) return setError('Select commissions for one referral, one retreat and one currency per payment.');
    setError('');
    setPayoutRows(outstanding);
    setPayoutRequestId(newRequestId());
    setPayoutForm({ expenseDate: today(), paymentMethod: 'bank_transfer', paymentAccount: '', reference: '', notes: '' });
  };
  const submitPayout = async (event: FormEvent) => {
    event.preventDefault();
    if (!payoutRows.length) return;
    setPaying(true);
    try {
      await referralsApi.createPayout({ requestId: payoutRequestId, referralId: payoutRows[0].referralId, retreatId: payoutRows[0].retreatId, bookingIds: payoutRows.map(row => row.bookingId), ...payoutForm });
      setPayoutRows([]);
      await load();
      setView('payments');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not record the referral payment.');
    } finally {
      setPaying(false);
    }
  };

  return <div className="mx-auto max-w-7xl p-4">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-3xl font-black text-slate-950">Referrals</h1><p className="text-slate-500">Manage referral partners and see every client and retreat attributed to them.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => navigate(`${routePrefix}/retreats?view=referrals`)} className="min-h-11 rounded-xl border border-blue-600 bg-blue-50 px-4 font-bold text-blue-700 hover:bg-blue-100">Holistic Retreats View</button>
        {selectedReferral && <button type="button" onClick={() => setSelectedReferral('')} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-700">Show all referrals</button>}
      </div>
    </div>
    {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}

    <form ref={editorRef} aria-label="Referral settings" onSubmit={save} onChange={() => setSavedMessage('')} onInvalidCapture={() => { setSavedMessage(''); setError('Complete the required fields and check the dates, prices and percentages before saving.'); }} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{editingId ? 'Edit referral' : 'Add referral'}</h2>{editingId && <button type="button" onClick={reset} aria-label="Cancel editing"><X size={20} /></button>}</div>
      <p className="mb-3 text-sm text-slate-600">To change an existing partner, choose its Edit commission settings button below. Save buttons store all settings for the partner shown here.</p>
      <div className="grid gap-3 md:grid-cols-5">
        <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Name *" className="min-h-12 rounded-xl border border-slate-300 px-3" required />
        <input value={form.referralCode} maxLength={2} onChange={event => setForm({ ...form, referralCode: event.target.value.replace(/[^a-z]/gi, '').toUpperCase() })} placeholder="Code (AD) *" className="min-h-12 rounded-xl border border-slate-300 px-3 uppercase" required />
        <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="Email" className="min-h-12 rounded-xl border border-slate-300 px-3" />
        <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Phone" className="min-h-12 rounded-xl border border-slate-300 px-3" />
        <label className="text-sm font-semibold text-slate-700">Default commission %<input type="number" min="0" max="100" step="0.01" value={form.defaultCommissionPercentage} onChange={event => setForm({ ...form, defaultCommissionPercentage: Number(event.target.value) })} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base font-normal" /></label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Influence commission % (blank uses existing packages/rates)<input type="number" min="0" max="100" step="0.01" value={form.influenceCommissionPercentage} onChange={event => setForm({ ...form, influenceCommissionPercentage: event.target.value === '' ? '' : Number(event.target.value) })} className="mt-1 w-full rounded border p-2" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowRepeatBookingCredit} onChange={event => setForm({ ...form, allowRepeatBookingCredit: event.target.checked })} />Allow explicitly credited repeat bookings</label>
      </div>

      <section aria-label="How commission rules work" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">
        <h3 className="font-bold text-slate-900">Which commission rule applies?</h3>
        <p className="mt-2"><strong>Commission packages are recommended for new agreements.</strong> Name each package, choose its booking dates and currency, then set a percentage, price tiers or a fixed amount. For example: “Summer 10%” for EUR bookings from June through August.</p>
        <p className="mt-2">When any packages exist, they replace the default percentage and rate schedule. A booking outside their dates or currencies shows “Needs configuration”; it does not fall back to another rate. Package dates use Prague time and include the end date.</p>
        <p className="mt-2">The rate schedule is the older percentage-only option. You do not need to configure both. An explicit influence percentage takes priority for influenced bookings. Recorded payments keep their original amounts and package details.</p>
      </section>
      <ReferralPackagesEditor value={form.commissionPackages} onChange={commissionPackages => setForm({ ...form, commissionPackages })} saveAction={<button type="submit" disabled={saving} className="mt-3 min-h-11 rounded-lg bg-blue-600 px-4 font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save commission packages'}</button>} />
      <section aria-label="Rate schedule" className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-700">Rate schedule (legacy percentage rules)</h3><button type="button" onClick={addRule} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">+ Add rate rule</button></div>
        <p className="mb-3 text-xs text-slate-500">Use this for existing percentage-only agreements when no commission packages are configured. It selects a percentage by booking registration date and price tier, then falls back to the default percentage if no rule matches. Client or retreat percentage overrides still take priority. Price thresholds use the booking currency; these rules have no currency filter.</p>
        {(form.rateSchedule || []).map((rule, ruleIndex) => <div key={ruleIndex} className="mb-2 rounded-lg bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-semibold text-slate-600">From<input type="date" value={rule.effectiveFrom} onChange={event => updateRule(ruleIndex, { effectiveFrom: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" required /></label>
            <label className="text-xs font-semibold text-slate-600">To (blank = ongoing)<input type="date" value={rule.effectiveTo || ''} onChange={event => updateRule(ruleIndex, { effectiveTo: event.target.value })} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" /></label>
            <button type="button" aria-label={`Remove rate rule ${ruleIndex + 1}`} onClick={() => removeRule(ruleIndex)} className="mt-1 self-end rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
          </div>
          <div className="mt-2 space-y-2">
            {rule.tiers.map((tier, tierIndex) => <div key={tierIndex} className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-600">From price<input type="number" min="0" value={tier.minPrice} onChange={event => updateTier(ruleIndex, tierIndex, { minPrice: Number(event.target.value) })} className="ml-1 min-h-9 w-28 rounded-lg border border-slate-300 px-2" /></label>
              <label className="text-xs text-slate-600">Rate %<input type="number" min="0" max="100" step="0.01" value={tier.ratePercent} onChange={event => updateTier(ruleIndex, tierIndex, { ratePercent: Number(event.target.value) })} className="ml-1 min-h-9 w-24 rounded-lg border border-slate-300 px-2" /></label>
              {rule.tiers.length > 1 && <button type="button" aria-label={`Remove price tier ${tierIndex + 1} of rule ${ruleIndex + 1}`} onClick={() => removeTier(ruleIndex, tierIndex)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"><X size={14} /></button>}
            </div>)}
            <button type="button" onClick={() => addTier(ruleIndex)} className="text-xs font-bold text-blue-700 hover:underline">+ Add price tier</button>
          </div>
        </div>)}
        {!(form.rateSchedule || []).length && <p className="text-sm text-slate-400">No dated rate rules. Without packages or other overrides, the default commission % applies.</p>}
        {form.commissionPackages.length > 0 && <p className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Commission packages are configured, so this rate schedule is saved but does not apply. Remove all packages to use the rate schedule again.</p>}
        <button type="submit" disabled={saving} className="mt-3 min-h-11 rounded-lg bg-blue-600 px-4 font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save rate schedule'}</button>
      </section>
      <textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Notes" className="mt-3 min-h-20 w-full rounded-xl border border-slate-300 p-3" />
      <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /> Active</label>
      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white py-3"><button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white"><Plus size={19} />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add referral'}</button><span className="text-xs text-slate-500">Saves the partner, rates and packages together.</span>{savedMessage && <p role="status" className="w-full text-sm font-semibold text-emerald-700">{savedMessage}</p>}</div>
    </form>
    {editingId && <ReferralPortalAccountEditor key={editingId} referralId={editingId} defaultEmail={form.email} />}

    <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => {
        const count = report.filter(item => item.referralId === row._id).length;
        const selected = selectedReferral === row._id;
        return <div key={row._id} role="button" tabIndex={0} onClick={() => setSelectedReferral(selected ? '' : row._id || '')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedReferral(selected ? '' : row._id || ''); }} className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 font-black text-blue-800">{row.referralCode || initials(row.name) || '--'}</span>
          <div className="min-w-0 flex-1"><div className="font-bold text-slate-950">{row.name} {row.isActive === false && <span className="text-xs text-slate-400">Inactive</span>}</div><div className="text-sm text-slate-500">{Number(row.defaultCommissionPercentage || 0)}% commission · {count} booking{count === 1 ? '' : 's'}</div></div>
          <button type="button" aria-label={`Edit ${row.name}`} onClick={event => { event.stopPropagation(); setSavedMessage(''); setError(''); setEditingId(row._id || ''); editorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); setForm({ name: row.name, referralCode: row.referralCode || initials(row.name).slice(0, 2), defaultCommissionPercentage: Number(row.defaultCommissionPercentage || 0), influenceCommissionPercentage: row.influenceCommissionPercentage ?? '', allowRepeatBookingCredit: row.allowRepeatBookingCredit !== false, email: row.email || '', phone: row.phone || '', notes: row.notes || '', isActive: row.isActive !== false, commissionPackages: row.commissionPackages || [], rateSchedule: (row.rateSchedule || []).map(rule => ({ ...rule, effectiveFrom: toDateInput(rule.effectiveFrom), effectiveTo: toDateInput(rule.effectiveTo) })) }); }} className="rounded-lg p-2 hover:bg-slate-100"><Pencil size={18} /><span className="ml-1 text-xs font-semibold">Edit commission settings</span></button>
          <button type="button" aria-label={`Delete ${row.name}`} onClick={async event => { event.stopPropagation(); if (row._id && window.confirm(`Delete referral “${row.name}”?`)) { await referralsApi.delete(row._id); if (selectedReferral === row._id) setSelectedReferral(''); await load(); } }} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
          <ChevronRight className={`text-slate-400 transition ${selected ? 'rotate-90' : ''}`} size={20} />
        </div>;
      })}
    </div>

    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Referral views"><button className="min-h-11 rounded-lg border px-4" aria-pressed={view === 'commissions'} onClick={() => setView('commissions')}>Commissions and clients</button><button className="min-h-11 rounded-lg border px-4" aria-pressed={view === 'payments'} onClick={() => setView('payments')}>Payment history</button></nav>
    {view === 'payments' ? <ReferralPaymentHistory prefix={routePrefix} initialReferral={selectedReferral} onChanged={load} /> : (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black">{selectedName ? `Clients referred by ${selectedName}` : 'Referred clients'}</h2><p className="text-sm text-slate-500">Non-cancelled bookings. Amount owed uses the referral commission percentage.</p></div>
        <div className="flex flex-wrap gap-2">{selectedRows.length > 0 && <button type="button" onClick={() => startPayout(selectedRows)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 font-bold text-white"><Wallet size={17} />Pay selected ({selectedRows.length})</button>}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client or referred-by (e.g. a friend's name)" className="min-h-11 min-w-[240px] rounded-xl border border-slate-300 px-3" /><select aria-label="Filter by referral" value={selectedReferral} onChange={event => { setSelectedReferral(event.target.value); setSelectedBookings(new Set()); }} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="">All referrals</option>{rows.map(row => <option key={row._id} value={row._id}>{row.referralCode ? `${row.referralCode} · ` : ''}{row.name}</option>)}</select><select aria-label="Filter by retreat" value={selectedRetreat} onChange={event => setSelectedRetreat(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="">All retreats</option>{retreatOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><select aria-label="Sort referred clients" value={sort} onChange={event => setSort(event.target.value as any)} className="min-h-11 rounded-xl border border-slate-300 px-3"><option value="referral">Sort by referral</option><option value="client">Sort by client</option><option value="retreat">Sort by retreat</option></select></div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(filtered.filter(row => row.paid).reduce<Record<string, number>>((sum, row) => ({ ...sum, [row.owedCurrency]: (sum[row.owedCurrency] || 0) + row.amountOwed }), {})).map(([currency, total]) => <div key={currency} className="rounded-xl bg-blue-50 px-4 py-3"><div className="text-xs font-bold uppercase">Already paid</div><div className="text-xl font-black">{money(total, currency)}</div></div>)}
        {Object.entries(totals).map(([currency, total]) => <div key={currency} className="rounded-xl bg-emerald-50 px-4 py-3"><div className="text-xs font-bold uppercase text-emerald-700">Total owed</div><div className="text-xl font-black text-emerald-950">{money(total, currency)}</div></div>)}
        {selectedReferral && retreatTotals.map(item => <div key={`${item.referralId}-${item.retreatId}-${item.currency}`} className="flex items-center gap-4 rounded-xl bg-slate-100 px-4 py-3"><div><div className="text-xs font-bold uppercase text-slate-500">{item.label}</div><div className="font-black">{money(item.amount, item.currency)} · {item.rows.length} item{item.rows.length === 1 ? '' : 's'}</div></div><button type="button" onClick={() => startPayout(item.rows)} className="ml-auto min-h-9 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white">Pay retreat</button></div>)}
      </div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="w-10 p-3"><span className="sr-only">Select</span></th><th className="p-3">Client</th><th className="p-3">Retreat</th><th className="p-3">Referral</th><th className="p-3">Referred by</th><th className="p-3">Booking</th><th className="p-3">Booking date</th><th className="p-3 text-right">Commission</th><th className="p-3">Payment</th></tr></thead><tbody className="divide-y divide-slate-200">{filtered.map(row => <tr key={row.bookingId} className={row.paid ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}><td className="p-3"><input type="checkbox" aria-label={`Select commission for booking ${row.bookingNumber || row.bookingId}`} checked={selectedBookings.has(row.bookingId)} disabled={row.paid || Boolean(row.commissionIssue)} onChange={event => setSelectedBookings(current => { const next = new Set(current); event.target.checked ? next.add(row.bookingId) : next.delete(row.bookingId); return next; })} /></td><td className="p-3"><button type="button" onClick={() => navigate(`${routePrefix}/clients/${row.clientId}`)} className="text-left font-bold text-slate-950 hover:text-blue-700 hover:underline">{row.clientName}</button><div className="text-xs text-slate-500">Client #{row.clientDisplayId || '—'} · {row.clientEmail || 'No email'}</div></td><td className="p-3 font-semibold">{row.retreatCode || row.retreatName || '—'}</td><td className="p-3"><span className="mr-2 rounded bg-blue-100 px-2 py-1 font-black text-blue-800">{row.referralCode || initials(row.referralName) || '--'}</span>{row.referralName}</td><td className="p-3">{row.referredByType && row.referredByType !== 'referral' ? <button type="button" onClick={() => setSearch(row.referredByLabel || '')} className="text-left font-semibold text-slate-800 hover:text-blue-700 hover:underline">{row.referredByLabel}<div className="text-xs text-indigo-700">{row.attributionType === 'direct' ? 'L1 · Direct referral' : row.attributionType === 'influenced' ? 'L2 · Influenced' : 'Inherited first booking'}</div>{row.attributionEvidence && <div className="text-xs text-slate-500">{row.attributionEvidence}</div>}{row.referredByType === 'friend_name' && <span className="ml-1 text-xs font-normal text-slate-400">(not a client)</span>}</button> : <span className="text-slate-400">—</span>}</td><td className="p-3"><button type="button" onClick={() => navigate(`${routePrefix}/bookings/${row.bookingId}`)} className="hover:text-blue-700 hover:underline">#{row.bookingNumber || '—'} · {row.commissionKind === 'fixed' ? row.packageName : `${row.commissionPercentage}%`}</button>{row.commissionKind !== 'fixed' && row.packageName && <div className="mt-1 max-w-64 whitespace-normal break-words text-xs text-slate-500">{row.packageName}</div>}</td><td className="p-3 text-slate-600">{row.registrationDate ? new Date(row.registrationDate).toLocaleDateString() : '—'}</td><td className="p-3 text-right font-black">{row.commissionIssue ? <span className="text-red-700" title={row.commissionIssue}>Needs configuration</span> : money(row.amountOwed, row.owedCurrency)}</td><td className="p-3">{row.paid && row.expenseId ? <div><button type="button" onClick={() => navigate(`${routePrefix}/expenses/${row.expenseId}`)} className="font-bold text-emerald-700 hover:underline">Paid · view expense</button><div className="text-xs text-slate-500">{row.paidAt ? new Date(row.paidAt).toLocaleDateString() : ''}</div></div> : <button type="button" onClick={() => startPayout([row])} disabled={Boolean(row.commissionIssue)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">Pay</button>}</td></tr>)}{!filtered.length && <tr><td colSpan={9} className="p-8 text-center text-slate-500">{loading ? 'Loading referred bookings…' : 'No referred bookings found.'}</td></tr>}</tbody></table></div>
    </section>)}

    {payoutRows.length > 0 && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="referral-payout-title">
      <form onSubmit={submitPayout} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between"><div><h2 id="referral-payout-title" className="text-xl font-black">Record referral payment</h2><p className="text-sm">Record a payment already made. This does not transfer money.</p><p className="text-sm text-slate-500">{payoutRows[0].referralName} · {payoutRows[0].retreatCode || payoutRows[0].retreatName} · {payoutRows.length} commission item{payoutRows.length === 1 ? '' : 's'}</p></div><button type="button" onClick={() => setPayoutRows([])} aria-label="Close payout"><X /></button></div>
        <div className="mb-4 rounded-xl bg-emerald-50 p-4"><div className="text-xs font-bold uppercase text-emerald-700">Payment total</div><div className="text-2xl font-black text-emerald-950">{money(payoutRows.reduce((sum, row) => sum + row.amountOwed, 0), payoutRows[0].owedCurrency)}</div></div>
        <div className="mb-4 max-h-44 overflow-y-auto rounded-xl border border-slate-200">{payoutRows.map(row => <div key={row.bookingId} className="flex justify-between gap-3 border-b border-slate-100 p-3 last:border-0"><div><strong>{row.clientName}</strong><div className="text-xs text-slate-500">Booking #{row.bookingNumber || '—'} · {row.commissionKind === 'fixed' ? row.packageName : `${row.commissionPercentage}%`}</div>{row.commissionKind !== 'fixed' && row.packageName && <div className="mt-1 max-w-64 whitespace-normal break-words text-xs text-slate-500">{row.packageName}</div>}</div><strong>{money(row.amountOwed, row.owedCurrency)}</strong></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Payment date<input type="date" value={payoutForm.expenseDate} onChange={event => setPayoutForm({ ...payoutForm, expenseDate: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" required /></label><label className="text-sm font-bold">Payment method<select value={payoutForm.paymentMethod} onChange={event => setPayoutForm({ ...payoutForm, paymentMethod: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label><label className="text-sm font-bold">Account<input value={payoutForm.paymentAccount} onChange={event => setPayoutForm({ ...payoutForm, paymentAccount: event.target.value })} placeholder="Revolut, CSOB…" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-bold">Reference<input value={payoutForm.reference} onChange={event => setPayoutForm({ ...payoutForm, reference: event.target.value })} placeholder="Transfer reference" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label></div>
        <label className="mt-3 block text-sm font-bold">Notes<textarea value={payoutForm.notes} onChange={event => setPayoutForm({ ...payoutForm, notes: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3" placeholder="Optional payout notes" /></label>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPayoutRows([])} className="min-h-11 rounded-lg border border-slate-300 px-4 font-bold">Cancel</button><button type="submit" disabled={paying} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50"><Wallet size={17} />{paying ? 'Recording…' : 'Record paid expense'}</button></div>
      </form>
    </div>}
  </div>;
};

export default ReferralsPage;
