import { newRequestId } from '../utils/requestId';
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Wallet, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Referral, ReferralReportRow } from '../types';
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value || 0);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
function commissionGuidance(row: ReferralReportRow) {
  const rawDate = row.firstPaymentDate || row.registrationDate;
  const parsed = rawDate ? new Date(rawDate) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', day: 'numeric', month: 'short', year: 'numeric' }).format(parsed) : '';
  const basis = row.firstPaymentDate ? 'First completed payment' : 'Registration date (no completed payment yet)';
  const issue = row.commissionIssue || 'Commission configuration is incomplete.';
  if (issue.startsWith('No commission package covers')) return `${basis}${date ? `: ${date}` : ''}. No commission package covers this date${issue.includes('currency') ? ' and booking currency' : ''}. In Commission packages, add or extend a package and enter the agreed percentage for this period.`;
  if (issue.includes('valid percentage')) return `${basis}${date ? `: ${date}` : ''}. The matching package needs a valid percentage. Update its dated percentages in Commission packages.`;
  return `${issue} ${date ? `${basis}: ${date}. ` : ''}Review the booking details and the partner’s commission settings.`;
}
function UsdTotal({ items }: { items: ReferralReportRow[] }) {
  if (!items.length) return null;
  const missing = items.filter(row => !Number.isFinite(row.usdEquivalent)).length;
  if (missing) return <div className="mt-1 text-sm font-medium text-amber-800">USD total unavailable · {missing} of {items.length} conversions missing</div>;
  const cents = items.reduce((sum, row) => sum + Math.round(row.usdEquivalent! * 100), 0);
  return <div className="mt-1 text-base font-bold text-blue-900">{items.some(row => !row.paid) ? 'Estimated USD total' : 'USD equivalent total'}: {money(cents / 100, 'USD')}</div>;
}
function today() { return new Date().toISOString().slice(0, 10); }
export default function ReferralCommissionsPage({ rows, report, loading, base, onChanged }: { rows: Referral[]; report: ReferralReportRow[]; loading: boolean; base: string; onChanged: () => Promise<void> }) {
  const routePrefix = base.replace(/\/referrals$/, '');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedReferral = params.get('referralId') || '';
  const selectedRetreat = params.get('retreatId') || '';
  const setSelectedReferral = (id: string) => setParams(current => { const next = new URLSearchParams(current); id ? next.set('referralId', id) : next.delete('referralId'); return next; });
  const setSelectedRetreat = (id: string) => setParams(current => { const next = new URLSearchParams(current); id ? next.set('retreatId', id) : next.delete('retreatId'); return next; });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'client' | 'retreat' | 'referral'>('referral');
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [payoutRows, setPayoutRows] = useState<ReferralReportRow[]>([]);
  const [payoutQuote, setPayoutQuote] = useState<any>(null);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [payoutRequestId, setPayoutRequestId] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopyFeedback({ text: 'Reference copied.', error: false });
    } catch {
      setCopyFeedback({ text: 'Could not copy the reference. Select the reference text and copy it manually.', error: true });
    }
  };
  const [payoutForm, setPayoutForm] = useState({ expenseDate: today(), paymentMethod: 'bank_transfer', paymentAccount: '', reference: '', notes: '' });
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(payoutRows.length > 0, dialogRef, () => { if (!paying) setPayoutRows([]); });
  useEffect(() => { setSelectedBookings(new Set()); }, [selectedReferral, selectedRetreat, report]);
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
    const groupKeys = new Set(outstanding.map(item => `${item.referralId}:${item.retreatId}:${item.payoutCurrency || item.owedCurrency}`));
    if (groupKeys.size !== 1) return setError('Select commissions for one referral, one retreat and one currency per payment.');
    setError('');
    setCopyFeedback(null);
    setPayoutQuote(null);
    setPayoutRows(outstanding);
    setPayoutRequestId(newRequestId());
    setPayoutForm({ expenseDate: today(), paymentMethod: 'bank_transfer', paymentAccount: '', reference: outstanding.map(row => row.refereeId).filter(Boolean).join('; '), notes: '' });
  };
  useEffect(() => {
    if (!payoutRows.length) return;
    let active = true;
    setPayoutQuote(null); setQuoteError(''); setQuoteBusy(true);
    const needsConversion = payoutRows.some(row => row.payoutCurrency && row.payoutCurrency !== row.owedCurrency);
    const localQuote = { amount: payoutRows.reduce((sum,row) => sum + row.amountOwed,0), currency: payoutRows[0].owedCurrency, originalTotals: { [payoutRows[0].owedCurrency]: payoutRows.reduce((sum,row) => sum + row.amountOwed,0) }, items: [] };
    const pending = needsConversion ? referralsApi.quotePayout({ referralId: payoutRows[0].referralId, retreatId: payoutRows[0].retreatId, bookingIds: payoutRows.map(row => row.bookingId), expenseDate: payoutForm.expenseDate }).then(response => response.data) : Promise.resolve(localQuote);
    pending.then(quote => { if (active) setPayoutQuote(quote); }).catch(error => { if (active) setQuoteError(apiErrorMessage({ ...error, config: { ...error.config, method: 'get' } }, 'Could not load the payment-date conversion.')); }).finally(() => { if (active) setQuoteBusy(false); });
    return () => { active = false; };
  }, [payoutRows, payoutForm.expenseDate, quoteVersion]);
  const convertedSummary = (items: ReferralReportRow[]) => {
    if (items.length && items.every(row => row.payoutAmount !== undefined && row.payoutCurrency === row.owedCurrency)) return <p className="mt-1 text-xs text-slate-500">Payout currency matches the original commissions.</p>;
    const available = items.filter(row => row.payoutAmount !== undefined);
    const sums = available.reduce<Record<string,number>>((sum,row) => ({ ...sum, [row.payoutCurrency || row.owedCurrency]: (sum[row.payoutCurrency || row.owedCurrency] || 0) + row.payoutAmount! }), {});
    return <div className="mt-1 text-sm font-semibold text-slate-700">{Object.entries(sums).map(([currency,amount]) => <span className="mr-3" key={currency}>{money(amount,currency)} payout{items.some(row => !row.paid) ? ' estimate' : ' recorded'}</span>)}{available.length < items.length && <span className="text-xs text-amber-800">{items.some(row => row.paid) ? 'Some payments have no recorded conversion.' : 'Some payout conversions are unavailable.'}</span>}</div>;
  };
  const submitPayout = async (event: FormEvent) => {
    event.preventDefault();
    if (!payoutRows.length || paying || quoteBusy || !payoutQuote) return;
    setPaying(true);
    try {
      await referralsApi.createPayout({ requestId: payoutRequestId, referralId: payoutRows[0].referralId, retreatId: payoutRows[0].retreatId, bookingIds: payoutRows.map(row => row.bookingId), ...payoutForm, ...(payoutRows.some(row => row.payoutCurrency && row.payoutCurrency !== row.owedCurrency) ? { expectedPayoutAmount: payoutQuote.amount, expectedPayoutCurrency: payoutQuote.currency } : {}) });
      setPayoutRows([]);
      await onChanged();
      navigate(`${base}/payments?referralId=${payoutRows[0].referralId}`);
    } catch (e: any) {
      setError(apiErrorMessage(e, 'Could not record the referral payment.'));
    } finally {
      setPaying(false);
    }
  };

  return <div>
    {error && !payoutRows.length && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black">{selectedName ? `Clients referred by ${selectedName}` : 'Referred clients'}</h2><p className="text-sm text-slate-500">Review applied packages and outstanding commissions, then record payments already made.</p></div>
        <div className="flex flex-wrap gap-2">{selectedRows.length > 0 && <button type="button" onClick={() => startPayout(selectedRows)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 font-bold text-white"><Wallet size={17} />Pay selected ({selectedRows.length})</button>}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client or referred-by (e.g. a friend's name)" className="min-h-11 w-full sm:w-auto min-w-0 rounded-xl border border-slate-300 px-3" /><select aria-label="Filter by referral" value={selectedReferral} onChange={event => { setSelectedReferral(event.target.value); setSelectedBookings(new Set()); }} className="min-h-11 max-w-full rounded-xl border border-slate-300 px-3"><option value="">All referrals</option>{rows.map(row => <option key={row._id} value={row._id}>{row.referralCode ? `${row.referralCode} · ` : ''}{row.name}</option>)}</select><select aria-label="Filter by retreat" value={selectedRetreat} onChange={event => setSelectedRetreat(event.target.value)} className="min-h-11 max-w-full rounded-xl border border-slate-300 px-3"><option value="">All retreats</option>{retreatOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><select aria-label="Sort referred clients" value={sort} onChange={event => setSort(event.target.value as any)} className="min-h-11 max-w-full rounded-xl border border-slate-300 px-3"><option value="referral">Sort by referral</option><option value="client">Sort by client</option><option value="retreat">Sort by retreat</option></select></div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(filtered.filter(row => row.paid).reduce<Record<string, number>>((sum, row) => ({ ...sum, [row.owedCurrency]: (sum[row.owedCurrency] || 0) + row.amountOwed }), {})).map(([currency, total]) => <div key={currency} className="rounded-xl bg-blue-50 px-4 py-3"><div className="text-xs font-bold uppercase">Already paid</div><div className="text-xl font-black">{money(total, currency)}</div><UsdTotal items={filtered.filter(row => row.paid && row.owedCurrency === currency)} /></div>)}
        {Object.entries(totals).map(([currency, total]) => <div key={currency} className="rounded-xl bg-emerald-50 px-4 py-3"><div className="text-xs font-bold uppercase text-emerald-700">{selectedRetreat ? 'Retreat total to pay' : 'Total owed'}</div><div className="text-xl font-black text-emerald-950">{money(total, currency)}</div><UsdTotal items={filtered.filter(row => !row.paid && !row.commissionIssue && row.owedCurrency === currency)} /></div>)}
        {(selectedReferral || selectedRetreat) && retreatTotals.map(item => <div key={`${item.referralId}-${item.retreatId}-${item.currency}`} className="flex items-center gap-4 rounded-xl bg-slate-100 px-4 py-3"><div><div className="text-xs font-bold uppercase text-slate-500">{item.label}{!selectedReferral && ` · ${item.rows[0].referralName}`}</div><div className="font-black">{money(item.amount, item.currency)} · {item.rows.length} item{item.rows.length === 1 ? '' : 's'}</div><UsdTotal items={item.rows} /></div><button type="button" onClick={() => startPayout(item.rows)} className="ml-auto min-h-9 rounded-lg bg-slate-950 px-3 text-sm font-bold text-white">Pay retreat</button></div>)}
      </div>
      {selectedRows.length > 0 && <div role="region" aria-label="Selected payment total" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-bold uppercase text-emerald-700">Selected to record as paid · {selectedRows.length} items</div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xl font-black text-emerald-950">{Object.entries(selectedRows.reduce<Record<string, number>>((sum, row) => ({ ...sum, [row.owedCurrency]: (sum[row.owedCurrency] || 0) + row.amountOwed }), {})).map(([currency, amount]) => <span key={currency}>{money(amount, currency)}</span>)}</div><UsdTotal items={selectedRows} /></div>}
      <div className="mb-4">{convertedSummary(selectedRows.length ? selectedRows : filtered.filter(row => !row.paid && !row.commissionIssue))}</div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead><tr className="text-left text-xs uppercase text-slate-500"><th className="w-10 p-3"><span className="sr-only">Select</span></th><th className="p-3">Client</th><th className="p-3">Retreat</th><th className="p-3">Referral</th><th className="p-3">Booking</th><th className="p-3">Commission date</th><th className="p-3 text-right">Commission</th><th className="p-3 text-right">USD equivalent</th><th className="p-3">Payment</th></tr></thead><tbody className="divide-y divide-slate-200">{filtered.map(row => <tr key={row.bookingId} className={row.paid ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}><td className="p-3"><input type="checkbox" aria-label={`Select commission for booking ${row.bookingNumber || row.bookingId}`} checked={selectedBookings.has(row.bookingId)} disabled={row.paid || Boolean(row.commissionIssue)} onChange={event => setSelectedBookings(current => { const next = new Set(current); event.target.checked ? next.add(row.bookingId) : next.delete(row.bookingId); return next; })} /></td><td className="p-3"><button type="button" onClick={() => navigate(`${routePrefix}/clients/${row.clientId}`)} className="text-left font-bold text-slate-950 hover:text-blue-700 hover:underline">{row.clientName}</button><div className="text-xs text-slate-500">Client #{row.clientDisplayId || '—'} · {row.clientEmail || 'No email'}</div></td><td className="p-3 font-semibold">{row.retreatCode || row.retreatName || '—'}</td><td className="p-3"><span className="mr-2 rounded bg-blue-100 px-2 py-1 font-black text-blue-800">{row.referralCode || initials(row.referralName) || '--'}</span>{row.referralName}</td><td className="p-3"><button type="button" onClick={() => navigate(`${routePrefix}/bookings/${row.bookingId}`)} className="hover:text-blue-700 hover:underline">#{row.bookingNumber || '—'}{!row.commissionIssue && <> · {row.commissionKind === 'fixed' ? row.packageName : `${row.commissionPercentage}%`}</>}</button>{!row.commissionIssue && row.commissionKind !== 'fixed' && row.packageName && <div className="mt-1 max-w-64 whitespace-normal break-words text-xs text-slate-500">{row.packageName}</div>}</td><td className="p-3 text-slate-600">{(row.firstPaymentDate || row.registrationDate) ? <><div>{new Date((row.firstPaymentDate || row.registrationDate)!).toLocaleDateString(undefined, { timeZone: 'Europe/Prague' })}</div><div className="mt-1 text-xs text-slate-500">{row.firstPaymentDate ? 'First completed payment' : 'Registration date · no completed payment yet'}</div></> : <span>No payment or registration date</span>}</td><td className="p-3 text-right font-black">{row.commissionIssue ? <div className="max-w-sm text-left font-normal"><div className="font-bold text-red-700">Commission setup needed</div><p className="mt-1 text-sm text-slate-600">{commissionGuidance(row)}</p></div> : <><div>{money(row.amountOwed, row.owedCurrency)}</div>{row.payoutAmount !== undefined && row.payoutCurrency !== row.owedCurrency ? <div className="mt-1 text-xs font-semibold text-blue-800">{money(row.payoutAmount, row.payoutCurrency || row.owedCurrency)} {row.paid ? 'recorded payout' : 'estimated payout'}<div className="font-normal text-slate-500">{row.exchangeRateSource} · {row.exchangeRateDate}{row.exchangeRate !== undefined && row.payoutCurrency !== row.owedCurrency ? ` · 1 ${row.owedCurrency} = ${row.exchangeRate.toFixed(6)} ${row.payoutCurrency}` : ''}</div></div> : <div className="mt-1 text-xs font-normal text-slate-500">{row.payoutAmount !== undefined ? (row.paid ? 'Paid in original currency' : 'Payout in original currency') : row.paid ? 'No recorded conversion' : row.payoutConversionIssue || 'Original currency'}</div>}</>}</td><td className="p-3 text-right"><div className="min-w-28">{row.commissionIssue ? <span className="text-sm text-slate-500">Awaiting commission setup</span> : row.usdEquivalent !== undefined ? <><div className="font-bold">{money(row.usdEquivalent, 'USD')}</div><div className="mt-1 text-xs text-slate-500">{row.usdEquivalentKind === 'recorded' ? 'Recorded USD payout' : row.usdEquivalentKind === 'estimate' ? 'Estimated USD equivalent' : 'USD equivalent at payment date'}</div>{row.usdEquivalentRateDate && <div className="text-xs text-slate-500">{row.usdEquivalentSource} · {row.usdEquivalentRateDate}</div>}</> : <span className="text-sm text-slate-500">{row.usdEquivalentIssue || 'USD equivalent unavailable'}</span>}</div></td><td className="p-3">{row.paid && row.expenseId ? <div><button type="button" onClick={() => navigate(`${routePrefix}/expenses/${row.expenseId}`)} className="font-bold text-emerald-700 hover:underline">Paid · view expense</button><div className="text-xs text-slate-500">{row.paidAt ? new Date(row.paidAt).toLocaleDateString() : ''}</div></div> : row.commissionIssue ? <Link to={`${base}/${row.referralId}/edit`} aria-label={`Configure commission for ${row.referralName}, booking ${row.bookingNumber || row.bookingId}`} className="inline-flex min-h-9 items-center rounded-lg border border-blue-300 bg-white px-3 text-sm font-bold text-blue-700 hover:bg-blue-50">Configure commission</Link> : <button type="button" onClick={() => startPayout([row])} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">Pay</button>}</td></tr>)}{!filtered.length && <tr><td colSpan={9} className="p-8 text-center text-slate-500">{loading ? 'Loading referred bookings…' : 'No referred bookings found.'}</td></tr>}</tbody></table></div>
    </section>

    {payoutRows.length > 0 && <div ref={dialogRef} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="referral-payout-title">
      <form onSubmit={submitPayout} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between"><div><h2 id="referral-payout-title" className="text-xl font-black">Record referral payment</h2><p className="text-sm">Record a payment already made. This does not transfer money.</p><p className="text-sm text-slate-500">{payoutRows[0].referralName} · {payoutRows[0].retreatCode || payoutRows[0].retreatName} · {payoutRows.length} commission item{payoutRows.length === 1 ? '' : 's'}</p></div><button type="button" disabled={paying} onClick={() => setPayoutRows([])} aria-label="Close payout"><X /></button></div>
        <p role="alert" className="mb-3 text-sm text-red-700">{error}</p><div className="mb-4 rounded-xl bg-emerald-50 p-4"><div className="text-xs font-bold uppercase text-emerald-700">Payment total</div><div className="text-2xl font-black text-emerald-950">{payoutQuote ? money(payoutQuote.amount, payoutQuote.currency) : 'Loading payment-date total…'}</div></div>
        {copyFeedback && <p role={copyFeedback.error ? 'alert' : 'status'} className={`mb-3 rounded-lg p-3 text-sm ${copyFeedback.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{copyFeedback.text}</p>}
        <button type="button" onClick={() => { setPayoutQuote(null); setQuoteVersion(value => value + 1); }} disabled={quoteBusy} className="mb-3 rounded-lg border px-3 py-2 text-sm">Refresh payment quote</button>
        {quoteError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-red-700">{quoteError}</p>}
        {payoutQuote && <div className="mb-4 text-sm text-slate-600">Original commissions: {Object.entries(payoutQuote.originalTotals).map(([currency,amount]) => money(Number(amount), currency)).join(' / ')}{payoutQuote.items?.some((item: any) => item.exchangeRateSource === 'ECB reference rate') && <div>ECB payment-date reference rates: {[...new Set(payoutQuote.items.map((item: any) => item.exchangeRateDate))].join(', ')}. If no rate was published that day, the preceding published rate is used.</div>}</div>}
        <div className="mb-4 space-y-3">{payoutRows.map(row => <div key={row.bookingId} className="min-w-0 rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0 break-words"><strong>{row.clientName}</strong><div className="text-xs text-slate-500">Booking #{row.bookingNumber || '—'}{!row.commissionIssue && <> · {row.commissionKind === 'fixed' ? row.packageName : `${row.commissionPercentage}%`}</>}</div>{!row.commissionIssue && row.commissionKind !== 'fixed' && row.packageName && <div className="mt-1 max-w-64 whitespace-normal break-words text-xs text-slate-500">{row.packageName}</div>}</div><div className="text-right"><strong>{money(row.amountOwed, row.owedCurrency)}</strong>{payoutQuote?.items?.filter((item: any) => item.bookingId === row.bookingId && item.payoutCurrency !== row.owedCurrency).map((item: any) => <div key={item.bookingId} className="mt-1 text-sm font-semibold text-blue-800">{money(item.payoutAmount, item.payoutCurrency)}<div className="text-xs font-normal">1 {row.owedCurrency} = {Number(item.exchangeRate).toFixed(6)} {item.payoutCurrency}</div></div>)}</div></div>
          <div className="mt-3 border-t border-slate-100 pt-3"><div className="mb-1 text-xs font-bold text-slate-500">Payment reference</div>{row.refereeId ? <div className="flex min-w-0 flex-wrap items-center gap-2"><code className="min-w-0 flex-1 select-text break-all rounded bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-800">{row.refereeId}</code><button type="button" onClick={() => void copyReference(row.refereeId!)} aria-label={`Copy reference for booking ${row.bookingNumber || row.bookingId}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold"><Copy size={16} />Copy reference</button></div> : <p className="text-sm text-amber-800">No generated reference is available for this booking. Enter the transfer reference below.</p>}</div>
        </div>)}</div>
        {payoutRows.length > 1 && <p className="mb-3 text-sm text-slate-600">Each item has its own reference. The Reference field below saves the available references separated by semicolons; edit it to match your actual transfer.</p>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Payment date<input type="date" max={today()} value={payoutForm.expenseDate} onChange={event => { setPayoutQuote(null); setPayoutForm({ ...payoutForm, expenseDate: event.target.value }); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" required /></label><label className="text-sm font-bold">Payment method<select value={payoutForm.paymentMethod} onChange={event => setPayoutForm({ ...payoutForm, paymentMethod: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label><label className="text-sm font-bold">Account<input value={payoutForm.paymentAccount} onChange={event => setPayoutForm({ ...payoutForm, paymentAccount: event.target.value })} placeholder="Revolut, CSOB…" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-bold">Reference<input value={payoutForm.reference} onChange={event => setPayoutForm({ ...payoutForm, reference: event.target.value })} placeholder="Transfer reference" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label></div>
        <label className="mt-3 block text-sm font-bold">Notes<textarea value={payoutForm.notes} onChange={event => setPayoutForm({ ...payoutForm, notes: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-3" placeholder="Optional payout notes" /></label>
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={paying} onClick={() => setPayoutRows([])} className="min-h-11 rounded-lg border border-slate-300 px-4 font-bold">Cancel</button><button type="submit" disabled={paying || quoteBusy || !payoutQuote} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-5 font-bold text-white disabled:opacity-50"><Wallet size={17} />{paying ? 'Recording…' : 'Record paid expense'}</button></div>
      </form>
    </div>}
  </div>;
}
