import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiClock, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { bookingDocumentsApi, bookingFlowApi, medicalReviewRequestsApi, paymentRequestsApi, remindersApi } from '../services/api';
import { AttentionItem, classifyAttention, clientLabel, entityId, entityLabel, isCompleteStatus, isPastRetreat, retreatEndDate, sortAttentionItems } from './NeedsAttentionPage.helpers';

const AlertIcon = FiAlertTriangle as any;
const ClockIcon = FiClock as any;
const RefreshIcon = FiRefreshCw as any;
const SearchIcon = FiSearch as any;
const dueValue = (record: any) => record?.dueDate || record?.deadline || record?.reminderDate || record?.followUpDate || record?.requestedAt;
const displayDate = (value?: string) => value ? new Date(value).toLocaleDateString() : 'No deadline';

const NeedsAttentionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.split('/').filter(Boolean)[0] || 'admin';
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [retreatTiming, setRetreatTiming] = useState<'current' | 'past' | 'all'>('current');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        bookingFlowApi.getItems({}), bookingDocumentsApi.getAll(), paymentRequestsApi.getAllFresh(),
        medicalReviewRequestsApi.getAll(), remindersApi.getPending(),
      ]);
      const data = results.map((result) => result.status === 'fulfilled' ? result.value.data || [] : []);
      if (results.every((result) => result.status === 'rejected')) throw new Error('No attention data could be loaded.');
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

  return <div className="p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold text-gray-900">Needs Attention</h1><p className="mt-1 text-sm text-gray-600">Open work across all retreats, ordered by severity and deadline.</p></div>
      <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><RefreshIcon className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-4">
      {[['overdue','Overdue','bg-red-50 text-red-800'],['blocked','Blocked','bg-rose-50 text-rose-800'],['problem','Problems','bg-amber-50 text-amber-800'],['due_soon','Due soon','bg-blue-50 text-blue-800']].map(([key,label,color]) => <div key={key} className={`rounded-lg p-4 ${color}`}><div className="text-2xl font-semibold">{counts[key] || 0}</div><div className="text-sm font-medium">{label}</div></div>)}
    </div>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1"><SearchIcon className="absolute left-3 top-3 text-gray-400" /><span className="sr-only">Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, retreat, item or status" className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm" /></label>
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category" className="rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="all">All categories</option>{['Booking step','Document','Payment','Contract','Medical review','Follow-up'].map((value) => <option key={value}>{value}</option>)}</select>
      <select value={retreatTiming} onChange={(event) => setRetreatTiming(event.target.value as typeof retreatTiming)} aria-label="Retreat timing" className="rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="current">Current & upcoming retreats</option><option value="past">Past retreats</option><option value="all">All retreats</option></select>
    </div>
    {error && <div role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {loading ? <div className="py-14 text-center text-gray-500">Loading attention items…</div> : filtered.length === 0 ? <div className="py-14 text-center text-gray-500">No open items match the current filters.</div> :
      <div className="overflow-x-auto rounded-lg border border-gray-200"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50"><tr>{['Status','Due','Category','Item','Client','Retreat',''].map((heading) => <th key={heading} className="px-4 py-3 text-left font-semibold text-gray-600">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 bg-white">{filtered.map((item) => <tr key={item.id} className="hover:bg-gray-50"><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${item.severity === 'overdue' || item.severity === 'blocked' ? 'bg-red-100 text-red-800' : item.severity === 'problem' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{item.severity === 'due_soon' ? <ClockIcon /> : <AlertIcon />}{item.severity.replace('_',' ')}</span></td><td className="whitespace-nowrap px-4 py-3 text-gray-700">{displayDate(item.dueDate)}</td><td className="px-4 py-3 text-gray-600">{item.category}</td><td className="px-4 py-3"><div className="font-medium text-gray-900">{item.title}</div><div className="max-w-xs truncate text-xs text-gray-500">{item.detail}</div></td><td className="px-4 py-3 text-gray-700">{item.client}</td><td className="px-4 py-3 text-gray-700">{item.retreat}</td><td className="px-4 py-3 text-right"><button onClick={() => navigate(item.href)} className="font-medium text-blue-600 hover:text-blue-800">Open</button></td></tr>)}</tbody></table></div>}
  </div>;
};

export default NeedsAttentionPage;
