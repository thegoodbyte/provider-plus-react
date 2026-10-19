import { percentageRangeLabel } from './referralDatePackages';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Mail, Pencil, Plus, Users, Wallet } from 'lucide-react';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { Referral, ReferralReportRow } from '../types';
import ReferralEditorPage from './ReferralEditorPage';
import ReferralCommissionsPage from './ReferralCommissionsPage';
import ReferralPaymentHistory from './ReferralPaymentHistory';
import { ReferralPortalAccountEditor } from './ReferralPortalAccountEditor';
import ReferralNotificationSettingsPage from './ReferralNotificationSettingsPage';

const money = (amount: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount || 0);
const action = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-800';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900';
const rulesLabel = (partner: Referral) => partner.commissionMode === 'dated_percentage' ? `${partner.commissionPackages?.length || 0} date-based package${partner.commissionPackages?.length === 1 ? '' : 's'}` : partner.commissionPackages?.length ? `${partner.commissionPackages.length} commission package${partner.commissionPackages.length === 1 ? '' : 's'}` : partner.rateSchedule?.length ? 'Dated rate schedule' : `${partner.defaultCommissionPercentage || 0}% default commission`;
const currencyTotals = (rows: ReferralReportRow[]) => rows.filter(row => !row.paid && !row.paymentReconciliationRequired && !row.commissionIssue).reduce<Record<string, number>>((totals, row) => ({ ...totals, [row.owedCurrency]: (totals[row.owedCurrency] || 0) + row.amountOwed }), {});

export default function ReferralsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const base = location.pathname.startsWith('/admin/') ? '/admin/referrals' : '/referrals';
  const parts = location.pathname.slice(base.length).split('/').filter(Boolean);
  const mode = parts[0] === 'new' ? 'new' : parts[0] === 'commissions' ? 'commissions' : parts[0] === 'payments' ? 'payments' : parts[0] === 'notification-settings' ? 'notification-settings' : parts[0] ? parts[1] === 'edit' ? 'edit' : parts[1] === 'access' ? 'access' : 'overview' : 'partners';
  const partnerId = ['overview', 'edit', 'access'].includes(mode) ? parts[0] : '';
  const needsReport = ['partners', 'overview', 'commissions'].includes(mode);
  const [partners, setPartners] = useState<Referral[]>([]);
  const [report, setReport] = useState<ReferralReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [deleting, setDeleting] = useState(false);
  const partner = partners.find(item => item._id === partnerId);
  const load = useCallback(async () => {
    setLoading(true);
    const [list, detail] = await Promise.allSettled([
      referralsApi.getAll({ suppressGlobalError: true }),
      needsReport ? referralsApi.getReport({ suppressGlobalError: true }) : Promise.resolve(null),
    ]);
    if (list.status === 'fulfilled') { setPartners(list.value.data || []); setError(''); }
    else setError(apiErrorMessage(list.reason, 'Could not load referral partners.'));
    if (detail.status === 'fulfilled') { if (detail.value) setReport(detail.value.data || []); setReportError(''); }
    else { setReportError(apiErrorMessage(detail.reason, 'Commission summary is unavailable.')); setReport([]); }
    setLoading(false);
  }, [needsReport]);
  useEffect(() => { void load(); }, [load]);
  const visiblePartners = useMemo(() => partners.filter(item => (status === 'all' || (status === 'active' ? item.isActive !== false : item.isActive === false)) && [item.name, item.referralCode, item.email, item.phone].join(' ').toLowerCase().includes(search.trim().toLowerCase())), [partners, status, search]);
  const ownRows = report.filter(row => row.referralId === partnerId);
  const ownTotals = currencyTotals(ownRows);
  const legacy = new URLSearchParams(location.search);
  if (mode === 'partners' && (legacy.get('view') === 'payments' || legacy.get('referralId') || legacy.get('view') === 'commissions')) {
    const next = new URLSearchParams(location.search); next.delete('view');
    return <Navigate replace to={`${base}/${legacy.get('view') === 'payments' ? 'payments' : 'commissions'}${next.toString() ? `?${next}` : ''}`} />;
  }
  const scopedPartner = partnerId || legacy.get('referralId') || '';
  const title = mode === 'partners' ? 'Referral partners' : mode === 'new' ? 'Add referral partner' : mode === 'edit' ? `Edit ${partner?.name || 'referral partner'}` : mode === 'commissions' ? 'Commissions' : mode === 'payments' ? 'Payment history' : mode === 'access' ? 'Portal access' : mode === 'notification-settings' ? 'Notification settings' : partner?.name || 'Referral partner';
  const subtitle = mode === 'partners' ? 'Your partner directory. Open a partner to see their bookings, agreement and payments.' : mode === 'commissions' ? 'Review referred bookings and record commissions already paid.' : mode === 'payments' ? 'Find recorded payments, linked expenses and corrections.' : mode === 'new' || mode === 'edit' ? 'Partner details and commission settings, with clear save controls.' : mode === 'access' ? `Manage the separate referral portal login for ${partner?.name || 'this partner'}.` : mode === 'notification-settings' ? 'Control which partners receive assignment emails, and in what language.' : 'Everything you need to know about this referral partner.';
  const deletePartner = async () => {
    if (!partner?._id || !window.confirm(`Delete referral “${partner.name}”?`)) return;
    setDeleting(true);
    try { await referralsApi.delete(partner._id); navigate(base); await load(); }
    catch (failure) { setError(apiErrorMessage(failure, 'Could not delete this partner.')); }
    finally { setDeleting(false); }
  };
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-800">Partner relationships</p><h1 className="break-words text-3xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">{subtitle}</p></div>
      {mode === 'partners' && <Link to={`${base}/new`} className={primary}><Plus size={18} />Add partner</Link>}
      {mode === 'overview' && partner && <Link to={`${base}/${partnerId}/edit`} className={primary} aria-label={`Edit ${partner.name}`}><Pencil size={17} />Edit partner</Link>}
    </header>
    {mode !== 'new' && mode !== 'edit' && <nav aria-label="Referral screens" className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {[['partners', base, 'Partners'], ['commissions', `${base}/commissions`, 'Commissions and clients'], ['payments', `${base}/payments`, 'Payment history'], ['notification-settings', `${base}/notification-settings`, 'Notification settings']].map(([key, to, label]) => <Link key={key} to={key !== 'partners' && key !== 'notification-settings' && scopedPartner ? `${to}?referralId=${encodeURIComponent(scopedPartner)}` : to} aria-current={mode === key ? 'page' : undefined} className={`${action} ${mode === key ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : ''}`}>{label}</Link>)}
      <Link to={`${base.replace(/\/referrals$/, '')}/retreats?view=referrals`} className={`${action} sm:ml-auto`}>Holistic Retreats View<ArrowUpRight size={16} /></Link>
    </nav>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}<button type="button" className="ml-3 font-semibold underline" onClick={() => void load()}>Retry</button></div>}
    {reportError && needsReport && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{reportError} <button type="button" onClick={() => void load()} className="font-semibold underline">Retry summary</button></p>}
    {loading && partners.length === 0 ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">Loading referral partners…</p> : error && partners.length === 0 ? null : (
      <>
        {mode === 'partners' && <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[['Partners', partners.length], ['Active partners', partners.filter(item => item.isActive !== false).length], ['Outstanding', reportError ? 'Unavailable' : report.filter(row => !row.paid && !row.paymentReconciliationRequired && !row.commissionIssue).length]].map(([label, value]) => <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5"><p className="break-words text-xs text-slate-500 sm:text-sm">{label}</p><strong className="mt-2 block text-3xl font-bold text-slate-950">{value}</strong></div>)}
          </div>
          <section aria-label="Partner directory" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">All partners <span className="ml-2 text-sm font-normal text-slate-400">{visiblePartners.length}</span></h2><div className="flex w-full flex-wrap gap-2 sm:w-auto"><input aria-label="Search partners" placeholder="Search name, code or contact" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 sm:w-64" /><select aria-label="Partner status" value={status} onChange={event => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visiblePartners.map(item => {
              const bookings = report.filter(row => row.referralId === item._id);
              const totals = currencyTotals(bookings);
              return <article key={item._id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-900">{item.referralCode || '—'}</span><div className="min-w-0 flex-1"><Link to={`${base}/${item._id}`} className="break-words text-lg font-semibold text-slate-950 hover:text-emerald-800">{item.name}</Link><p className="mt-1 text-xs text-slate-500">{rulesLabel(item)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.isActive === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-800'}`}>{item.isActive === false ? 'Inactive' : 'Active'}</span></div>
                <p className="mt-4 flex min-w-0 items-center gap-2 break-all text-sm text-slate-500"><Mail size={15} className="shrink-0" />{item.email || 'No email recorded'}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-sm"><span className="text-slate-500">{reportError ? 'Bookings unavailable' : `${bookings.length} referred booking${bookings.length === 1 ? '' : 's'}`}</span><span className="font-semibold text-slate-800">{reportError ? 'Summary unavailable' : bookings.some(row => row.commissionIssue) ? 'Needs commission configuration' : Object.entries(totals).map(([currency, amount]) => money(amount, currency)).join(' · ') || (ownRows.some(row => row.paymentReconciliationRequired) ? 'Payment allocation review needed' : 'No outstanding commission')}</span></div>
                <div className="mt-auto flex flex-wrap gap-2 pt-5"><Link to={`${base}/${item._id}`} className={action}>View partner<ArrowUpRight size={15} /></Link><Link to={`${base}/${item._id}/edit`} aria-label={`Edit ${item.name}`} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-emerald-800"><Pencil size={15} />Edit settings</Link></div>
              </article>;
            })}</div>
            {!visiblePartners.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Users className="mx-auto mb-3 text-slate-400" /><h3 className="font-semibold">{partners.length ? 'No partners match your search' : 'Start your partner directory'}</h3><p className="mt-2 text-sm text-slate-500">{partners.length ? 'Try another name or change the status filter.' : 'Add a referral partner, then set their commission agreement.'}</p>{!partners.length && <Link to={`${base}/new`} className={`${primary} mt-4`}>Add your first partner</Link>}</div>}
          </section>
        </>}
        {(mode === 'new' || mode === 'edit') && (mode === 'new' || partner ? <ReferralEditorPage key={partnerId || 'new'} referral={partner} base={base} onSaved={load} /> : <MissingPartner base={base} />)}
        {mode === 'commissions' && <ReferralCommissionsPage rows={partners} report={report} loading={loading} base={base} onChanged={load} />}
        {mode === 'payments' && <ReferralPaymentHistory prefix={base.replace(/\/referrals$/, '')} initialReferral={new URLSearchParams(location.search).get('referralId') || ''} onChanged={load} />}
        {mode === 'notification-settings' && <ReferralNotificationSettingsPage partners={partners} onPartnerSaved={load} />}
        {(mode === 'overview' || mode === 'access') && (partner ? <>
          <Link to={base} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16} />All partners</Link>
          {mode === 'access' ? <div className="max-w-3xl"><Link to={`${base}/${partnerId}`} className={`${action} mb-4`}>Back to partner</Link><ReferralPortalAccountEditor key={partnerId} referralId={partnerId} defaultEmail={partner.email || ''} /></div> : <>
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <section aria-label="Partner overview" className="rounded-2xl border border-slate-200 bg-white p-6"><span className="rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-900">{partner.referralCode || 'No code'}</span><h2 className="mt-5 text-lg font-semibold">Contact & agreement</h2><dl className="mt-4 space-y-4 text-sm">{[['Status', partner.isActive === false ? 'Inactive' : 'Active'], ['Email', partner.email || 'Not recorded'], ['Phone', partner.phone || 'Not recorded'], ['Commission agreement', rulesLabel(partner)]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900">{value}</dd></div>)}</dl>{partner.notes && <p className="mt-5 whitespace-pre-wrap break-words border-t pt-4 text-sm text-slate-600">{partner.notes}</p>}<Link to={`${base}/${partnerId}/access`} className={`${action} mt-5`}>Manage portal access</Link></section>
              <div className="space-y-5"><section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6"><Wallet className="text-emerald-800" /><p className="mt-3 text-sm text-emerald-800">Outstanding commission</p><strong className="mt-2 block text-3xl font-bold text-emerald-950">{reportError ? 'Unavailable' : Object.entries(ownTotals).map(([currency, amount]) => money(amount, currency)).join(' · ') || (ownRows.some(row => row.paymentReconciliationRequired) ? 'Payment allocation review needed' : 'No outstanding commission')}</strong><p className="mt-3 text-sm text-emerald-800">{ownRows.length} referred booking{ownRows.length === 1 ? '' : 's'}{ownRows.some(row => row.commissionIssue) ? ' · Some bookings need commission configuration' : ''}</p><div className="mt-5 flex flex-wrap gap-2"><Link to={`${base}/commissions?referralId=${partnerId}`} className={primary}>View commissions</Link><Link to={`${base}/payments?referralId=${partnerId}`} className={action}>View payment history</Link></div></section>
                <section aria-label="Applied agreement" className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold">Commission agreement</h2><p className="mt-2 text-sm text-slate-500">{partner.commissionMode === 'dated_percentage' ? 'The booking registration date selects the percentage. All booking currencies use the same agreement.' : 'Existing agreement. Edit the settings to use simple date-based percentages.'}</p>{(partner.commissionPackages || []).map(rule => <div key={rule.key} className="mt-4 flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-4"><div className="min-w-0"><strong className="break-words">{rule.name}</strong><p className="mt-1 text-xs text-slate-500">{rule.effectiveFrom} → {rule.effectiveTo || 'Ongoing'} · {rule.bookingCurrency === '*' ? 'All booking currencies' : rule.bookingCurrency}</p></div><span className="text-sm font-semibold">{rule.rates?.length ? rule.rates.map((rate, index) => <span className="block" key={rate.effectiveFrom}>{percentageRangeLabel(rule, index)} · {rate.ratePercent}%</span>) : rule.kind === 'fixed' ? money(rule.amount || 0, rule.currency || 'USD') : rule.tiers?.length ? 'Price tiers' : `${rule.ratePercent || 0}%`}</span></div>)}<Link to={`${base}/${partnerId}/edit`} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-800"><Pencil size={15} />Edit commission settings</Link></section>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 pt-4"><button type="button" disabled={deleting} onClick={() => void deletePartner()} aria-label={`Delete ${partner.name}`} className="min-h-11 px-3 text-sm font-medium text-red-700">{deleting ? 'Deleting…' : 'Delete partner'}</button></div>
          </>}
        </> : <MissingPartner base={base} />)}
      </>
    )}
  </div>;
}

function MissingPartner({ base }: { base: string }) {
  return <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6"><p>This referral partner could not be found.</p><Link to={base} className={`${action} mt-4`}>Back to partners</Link></div>;
}
