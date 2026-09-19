import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { bookingDocumentsApi, bookingFlowApi, medicalReviewRequestsApi, paymentRequestsApi, remindersApi } from '../services/api';
import { AttentionItem, attentionActionLabel, attentionStatusLabel, classifyAttention, clientLabel, entityId, entityLabel, isCompleteStatus, isPastRetreat, retreatEndDate, sortAttentionItems } from './NeedsAttentionPage.helpers';
import { formatCalendarDate } from '../utils/dateFormat';
import './NeedsAttentionPage.css';

const inlineErrors = { suppressGlobalError: true };

const RefreshIcon = FiRefreshCw as any;
const SearchIcon = FiSearch as any;
const dueValue = (record: any) => record?.dueDate || record?.deadline || record?.reminderDate || record?.followUpDate || record?.requestedAt;
const displayDate = (value?: string) => { const formatted = formatCalendarDate(value); return formatted === 'N/A' ? 'No deadline' : formatted; };
const QUEUE_STATE_KEY = 'needs-attention:queue-state:v1';
const PAGE_SIZE = 20;

const NeedsAttentionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.split('/').filter(Boolean)[0] || 'admin';
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [retreatTiming, setRetreatTiming] = useState<'current' | 'past' | 'all'>('current');
  const [page, setPage] = useState(1);
  const [resolvingId, setResolvingId] = useState('');
  const [restoredQueueState, setRestoredQueueState] = useState(false);
  const queueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(QUEUE_STATE_KEY) || '{}');
      if (typeof saved.query === 'string') setQuery(saved.query);
      if (typeof saved.category === 'string') setCategory(saved.category);
      if (['current', 'past', 'all'].includes(saved.retreatTiming)) setRetreatTiming(saved.retreatTiming);
      if (Number.isInteger(saved.page) && saved.page > 0) setPage(saved.page);
      requestAnimationFrame(() => { if (typeof saved.scrollY === 'number' && typeof window.scrollTo === 'function') { try { window.scrollTo(0, saved.scrollY); } catch { /* jsdom and embedded webviews may not implement scrolling. */ } } });
    } catch { /* Ignore invalid session state. */ }
    finally { setRestoredQueueState(true); }
  }, []);

  useEffect(() => {
    if (!restoredQueueState) return;
    sessionStorage.setItem(QUEUE_STATE_KEY, JSON.stringify({ query, category, retreatTiming, page, scrollY: window.scrollY }));
  }, [query, category, retreatTiming, page, restoredQueueState]);

  useEffect(() => {
    const saveScroll = () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(QUEUE_STATE_KEY) || '{}');
        sessionStorage.setItem(QUEUE_STATE_KEY, JSON.stringify({ ...saved, scrollY: window.scrollY }));
      } catch { /* Ignore storage failures. */ }
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => window.removeEventListener('scroll', saveScroll);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setFailedSources([]);
    setItems([]);
    try {
      const results = await Promise.allSettled([
        bookingFlowApi.getItems({}, inlineErrors), bookingDocumentsApi.getAll({}, inlineErrors), paymentRequestsApi.getAllFresh(inlineErrors),
        medicalReviewRequestsApi.getAll({}, inlineErrors), remindersApi.getPending(inlineErrors),
      ]);
      const data = results.map((result) => result.status === 'fulfilled' ? result.value.data || [] : []);
      const sources = ['Booking steps / Contracts', 'Documents / Contracts', 'Payments', 'Medical reviews', 'Follow-ups'];
      setFailedSources(sources.filter((_, index) => results[index].status === 'rejected'));
      const [steps, documents, payments, reviews, reminders] = data as any[][];
      const next: AttentionItem[] = [];

      steps.filter((item) => !isCompleteStatus(item.status)).forEach((item) => {
        const bookingId = entityId(item.bookingId);
        const isContract = /contract/i.test(`${item.title || ''} ${item.key || ''}`);
        next.push({ id: `step-${item._id}`, category: isContract ? 'Contract' : 'Booking step', title: item.title || 'Booking step', detail: item.notes || item.status || 'Pending', retreat: entityLabel(item.retreatId), retreatEndDate: retreatEndDate(item.retreatId), client: clientLabel(item.clientId), dueDate: dueValue(item), severity: classifyAttention(item.status, dueValue(item)), href: `/${prefix}/booking-flow/${bookingId}` });
      });
      documents.filter((item) => !isCompleteStatus(item.status) && String(item.status || '').toLowerCase() !== 'stored').forEach((item) => {
        const bookingId = entityId(item.bookingId);
        next.push({ id: `document-${item._id}`, category: /contract/i.test(item.documentType || item.title || '') ? 'Contract' : 'Document', title: item.title || item.documentType || 'Document', detail: item.status || 'Action required', retreat: entityLabel(item.retreatId), retreatEndDate: retreatEndDate(item.retreatId), client: clientLabel(item.clientId), dueDate: dueValue(item), severity: classifyAttention(item.status, dueValue(item)), href: bookingId ? `/${prefix}/bookings/${bookingId}` : `/${prefix}/booking-documents` });
      });
      payments.filter((item) => !isCompleteStatus(item.status)).forEach((item) => {
        next.push({ id: `payment-${item._id}`, category: 'Payment', title: `Payment request #${item.display_id || item.invoiceNumber || '—'}`, detail: `${item.status || 'pending'}${item.requestedAmount ? ` · ${item.requestedAmount} ${item.currency || ''}` : ''}`, retreat: entityLabel(item.retreatId), retreatEndDate: retreatEndDate(item.retreatId), client: clientLabel(item.clientId), dueDate: dueValue(item), severity: classifyAttention(item.status, dueValue(item)), href: `/${prefix}/payment-requests/${item._id}` });
      });
      reviews.filter((item) => !isCompleteStatus(item.status)).forEach((item) => {
        next.push({ id: `review-${item._id}`, category: 'Medical review', title: `Medical review #${item.display_id || '—'}`, detail: item.requestType || item.status || 'Pending review', retreat: entityLabel(item.retreatId), retreatEndDate: retreatEndDate(item.retreatId), client: clientLabel(item.clientId), dueDate: dueValue(item), severity: classifyAttention(item.status, dueValue(item)), href: `/${prefix}/medical-review-requests/${item._id}` });
      });
      reminders.filter((item) => !isCompleteStatus(item.status)).forEach((item) => {
        next.push({ id: `reminder-${item._id}`, category: 'Follow-up', title: item.title || item.message || 'Follow-up', detail: item.description || item.status || 'Pending', retreat: entityLabel(item.retreatId), retreatEndDate: retreatEndDate(item.retreatId), client: clientLabel(item.clientId), dueDate: dueValue(item), severity: classifyAttention(item.status, dueValue(item)), href: `/${prefix}/reminders` });
      });
      setItems(sortAttentionItems(next));
    } catch (loadError: any) { setError(loadError?.message || 'Unable to load needs-attention data.'); }
    finally { setLoading(false); }
  }, [prefix]);

  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => items.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const past = isPastRetreat(item.retreatEndDate);
    const matchesRetreatTiming = retreatTiming === 'all' || (retreatTiming === 'past' ? past : !past);
    const haystack = `${item.title} ${item.detail} ${item.retreat} ${item.client}`.toLowerCase();
    return matchesCategory && matchesRetreatTiming && haystack.includes(query.trim().toLowerCase());
  }), [items, category, query, retreatTiming]);
  const counts = useMemo(() => filtered.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.severity]: (acc[item.severity] || 0) + 1 }), {}), [filtered]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const resolveReminder = async (item: AttentionItem) => {
    if (!item.id.startsWith('reminder-')) return;
    const id = item.id.slice('reminder-'.length);
    setResolvingId(item.id);
    setItems(current => current.filter(row => row.id !== item.id));
    try {
      await remindersApi.complete(id);
    } catch (resolveError: any) {
      setItems(current => sortAttentionItems([...current, item]));
      setError(resolveError?.response?.data?.message || 'Unable to complete follow-up.');
    } finally { setResolvingId(''); }
  };

  const openItem = (item: AttentionItem) => {
    sessionStorage.setItem(QUEUE_STATE_KEY, JSON.stringify({ query, category, retreatTiming, page, scrollY: window.scrollY }));
    navigate(item.href, { state: { returnTo: location.pathname, needsAttention: true } });
  };

  const renderStatus = (item: AttentionItem) => <span className={`needs-attention-status status-${item.severity}`}><span aria-hidden="true">{item.severity === 'due_soon' ? '◷' : item.severity === 'overdue' ? '!' : item.severity === 'blocked' ? '×' : '!'}</span>{attentionStatusLabel(item.severity)}</span>;
  const renderAction = (item: AttentionItem) => <div className="needs-attention-actions"><button type="button" onClick={() => openItem(item)} aria-label={`${attentionActionLabel(item)} for ${item.client}`} className="needs-attention-action">{attentionActionLabel(item)}</button>{item.category === 'Follow-up' && <button type="button" onClick={() => resolveReminder(item)} disabled={resolvingId === item.id} aria-label={`Mark ${item.title} complete`} className="needs-attention-resolve">{resolvingId === item.id ? 'Completing…' : 'Mark complete'}</button>}</div>;

  return <div ref={queueRef} className="needs-attention-page p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold text-gray-900">Needs Attention</h1><p className="mt-1 text-sm text-gray-600">Open work across all retreats, ordered by severity and deadline.</p></div>
      <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><RefreshIcon className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-4">
      {[['overdue','Overdue','bg-red-50 text-red-800'],['blocked','Blocked','bg-rose-50 text-rose-800'],['problem','Problems','bg-amber-50 text-amber-800'],['due_soon','Due soon','bg-blue-50 text-blue-800']].map(([key,label,color]) => <div key={key} className={`rounded-lg p-4 ${color}`}><div className="text-2xl font-semibold">{loading || error || failedSources.length === 5 ? '—' : counts[key] || 0}</div><div className="text-sm font-medium">{label}</div></div>)}
    </div>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1"><SearchIcon className="absolute left-3 top-3 text-gray-400" /><span className="sr-only">Search</span><input aria-label="Search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search client, retreat, item or status" className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm" /></label>
      <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Category" className="rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="all">All categories</option>{['Booking step','Document','Payment','Contract','Medical review','Follow-up'].map((value) => <option key={value}>{value}</option>)}</select>
      <select value={retreatTiming} onChange={(event) => { setRetreatTiming(event.target.value as typeof retreatTiming); setPage(1); }} aria-label="Retreat timing" className="rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="current">Current & upcoming retreats</option><option value="past">Past retreats</option><option value="all">All retreats</option></select>
    </div>
    {failedSources.length > 0 && <div role="alert" className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Unable to load: {failedSources.join(', ')}. Counts and results are incomplete. <button type="button" onClick={load} disabled={loading} className="underline font-semibold">Retry unavailable data</button></div>}
    {error && <div role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" onClick={load} disabled={loading}>Retry</button></div>}
    {loading ? <div className="py-14 text-center text-gray-500">Loading attention items…</div> : filtered.length === 0 ? <div className="py-14 text-center text-gray-500">{error || failedSources.length ? 'Unable to confirm all open items. Retry unavailable data.' : 'No open items match the current filters.'}</div> : <>
      <div className="needs-attention-mobile-list">{pageItems.map(item => <article key={item.id} className="needs-attention-card"><div className="needs-attention-card-top">{renderStatus(item)}<time>{displayDate(item.dueDate)}</time></div><h2>{item.title}</h2><p className="needs-attention-card-issue">{item.detail}</p><dl><div><dt>Client</dt><dd>{item.client}</dd></div><div><dt>Retreat</dt><dd>{item.retreat}</dd></div></dl>{renderAction(item)}</article>)}</div>
      <div className="needs-attention-desktop-table overflow-x-auto rounded-lg border border-gray-200"><table className="min-w-full divide-y divide-gray-200 text-sm"><caption className="sr-only">Needs Attention queue</caption><thead className="bg-gray-50"><tr>{['Status','Due','Category','Item','Client','Retreat','Action'].map((heading) => <th key={heading} scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 bg-white">{pageItems.map((item) => <tr key={item.id} className="hover:bg-gray-50"><td className="px-4 py-3">{renderStatus(item)}</td><td className="whitespace-nowrap px-4 py-3 text-gray-700">{displayDate(item.dueDate)}</td><td className="px-4 py-3 text-gray-600">{item.category}</td><td className="px-4 py-3"><div className="font-medium text-gray-900">{item.title}</div><div className="max-w-xs truncate text-xs text-gray-500">{item.detail}</div></td><td className="px-4 py-3 text-gray-700">{item.client}</td><td className="px-4 py-3 text-gray-700">{item.retreat}</td><td className="px-4 py-3">{renderAction(item)}</td></tr>)}</tbody></table></div>
      <nav aria-label="Needs Attention pages" className="needs-attention-pagination"><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous page">Previous</button><span aria-live="polite">Page {page} of {pageCount}</span><button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Next page">Next</button></nav>
    </>}
  </div>;
};

export default NeedsAttentionPage;
