import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, Info, RefreshCw, Search } from 'lucide-react';
import { ScratchpadSnapshot } from '../services/api';
import './ScratchpadOverview.css';

type Filters = { from: string; to: string; provider: string; account: string; currency: string; search: string; status: string; sort: string };
type Preset = 'All time' | 'Today' | '7 days' | '30 days';
const presets: Preset[] = ['All time', 'Today', '7 days', '30 days'];
const statuses = [['logged', 'Logged'], ['unassigned', 'Unassigned'], ['converted', 'Converted / linked'], ['excluded', 'Excluded']] as const;
const currencies = ['CZK', 'EUR', 'PLN', 'USD'];
const providers = { csob: 'ČSOB', revolut: 'Revolut', paypal: 'PayPal' };
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function scratchpadDateRange(preset: Preset, now = new Date()) {
  if (preset === 'All time') return { from: '', to: '' };
  const start = new Date(now);
  start.setDate(start.getDate() - (preset === '7 days' ? 6 : preset === '30 days' ? 29 : 0));
  return { from: localDate(start), to: localDate(now) };
}
const amountLabel = (amount: string) => amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export function ScratchpadRefresh({ snapshot, loading, failed, onRefresh }: { snapshot: ScratchpadSnapshot | null; loading: boolean; failed: boolean; onRefresh: () => void }) {
  return <button type="button" className="scratchpad-refresh" aria-label="Refresh" disabled={loading} onClick={onRefresh} title={snapshot ? `Last successful refresh: ${new Date(snapshot.refreshedAt).toLocaleString()}` : 'Refresh receipts'}>
    <span className={`scratchpad-fresh-dot${failed ? ' is-stale' : ''}`} aria-hidden="true" />
    <span>{loading ? 'Updating…' : failed ? 'Refresh failed' : snapshot ? `Updated ${new Date(snapshot.refreshedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Refresh'}<span className="sr-only">{snapshot ? ` Last successful refresh: ${new Date(snapshot.refreshedAt).toLocaleString()}` : ''}</span></span><RefreshCw size={17} aria-hidden="true" />
  </button>;
}
export default function ScratchpadOverview({ filters, onChange, onClear, snapshot, loading, error }: { filters: Filters; onChange: (filters: Filters) => void; onClear: () => void; snapshot: ScratchpadSnapshot | null; loading: boolean; error: string }) {
  const search = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState(false);
  const preset = presets.find(name => { const range = scratchpadDateRange(name); return range.from === filters.from && range.to === filters.to; });
  const showCustom = custom || !preset;
  const change = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });
  const changed = Boolean(filters.search || filters.from || filters.to || filters.provider || filters.account || filters.currency || filters.sort !== 'date-desc');
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault(); search.current?.focus();
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  return <section className="scratchpad-overview" aria-label="Received-money overview">
    <div className="scratchpad-filter-top">
      <div className="scratchpad-search"><Search size={18} aria-hidden="true" /><input ref={search} aria-label="Search payer, phone, transaction or request number" placeholder="Search SP ID, payer, reference, transaction or request #" value={filters.search} onChange={event => change('search', event.target.value)} /><kbd aria-hidden="true">/</kbd></div>
      <div className="scratchpad-date-presets" role="group" aria-label="Received date range">{presets.map(name => <button type="button" key={name} aria-pressed={!custom && preset === name} onClick={() => { setCustom(false); onChange({ ...filters, ...scratchpadDateRange(name) }); }}>{name}</button>)}<button type="button" aria-pressed={showCustom} onClick={() => setCustom(true)}>Custom</button></div>
    </div>
    {showCustom && <div className="scratchpad-custom-dates"><label>From date<input type="date" aria-label="From date" value={filters.from} onChange={event => change('from', event.target.value)} /></label><span aria-hidden="true">–</span><label>To date<input type="date" aria-label="To date" value={filters.to} onChange={event => change('to', event.target.value)} /></label></div>}
    <div className="scratchpad-filter-bottom">
      <label className="scratchpad-filter-chip">Provider<select aria-label="Filter provider" value={filters.provider} onChange={event => change('provider', event.target.value)}><option value="">All</option>{Object.entries(providers).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="scratchpad-filter-chip">Currency<select aria-label="Filter currency" value={filters.currency} onChange={event => change('currency', event.target.value)}><option value="">All</option>{currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
      <label className="scratchpad-filter-chip scratchpad-account">Account<input aria-label="Filter account" placeholder="any" value={filters.account} onChange={event => change('account', event.target.value)} /></label>
      {changed && <button type="button" className="scratchpad-clear" onClick={() => { setCustom(false); onClear(); }}>Clear filters</button>}
      <label className="scratchpad-sort"><ArrowDownUp size={18} aria-hidden="true" /><select aria-label="Sort receipts" value={filters.sort} onChange={event => change('sort', event.target.value)}><option value="date-desc">Received · newest first</option><option value="date-asc">Received · oldest first</option><option value="amount-desc">Amount · highest first</option><option value="amount-asc">Amount · lowest first</option><option value="payer-asc">Payer · A–Z</option></select></label>
    </div>
    {error && <p role="alert" className="scratchpad-load-error">{error} {snapshot ? 'Previous snapshot shown below; it may not match the current filters.' : 'No snapshot available.'}</p>}
    {loading && <p role="status" className="scratchpad-loading">Loading receipts…</p>}
    {snapshot && <div className={`scratchpad-totals-strip${loading || error ? ' is-stale' : ''}`}>
      <table className="scratchpad-totals"><caption className="sr-only">Totals by currency and status</caption><thead className="sr-only"><tr><th>Currency</th>{statuses.map(([value, label]) => <th key={value}>{label}</th>)}</tr></thead><tbody>{currencies.filter(currency => snapshot.totals.some(total => total.currency === currency)).map(currency => <tr key={currency}><th scope="row" className="sr-only">{currency}</th>{statuses.map(([status, label]) => { const total = snapshot.totals.find(item => item.currency === currency && item.status === status); return <td key={status}><span className="scratchpad-total-title" aria-hidden="true">{label}</span><div className="scratchpad-total-value"><strong>{amountLabel(total?.amount || '0.00')}</strong><span>{currency}</span><span className="scratchpad-total-count" aria-label={`${total?.count || 0} receipts`}>{total?.count || 0}</span></div></td>; })}</tr>)}</tbody></table>
      <details className="scratchpad-totals-help"><summary><Info size={16} aria-hidden="true" />How totals work</summary><p>Logged receipts only—not a bank balance. Totals use the date, provider, account, currency and search filters across all pages, independently of the status tab. Excluded receipts are shown separately. Currencies are never combined.</p></details>
    </div>}
  </section>;
}
