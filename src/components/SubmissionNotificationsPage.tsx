import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiCheck, FiExternalLink, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api, bookingDocumentsApi } from '../services/api';

const BellIcon = FiBell as any; const CheckIcon = FiCheck as any; const ExternalLinkIcon = FiExternalLink as any; const RefreshIcon = FiRefreshCw as any; const SearchIcon = FiSearch as any;

type Related = { _id?: string; display_id?: number; firstName?: string; lastName?: string; name?: string; code?: string; bookingNumber?: number };
type Notice = { _id: string; name: string; description?: string; status?: string; sourceId?: string; sourceRoute?: string; notificationReadAt?: string; createdAt?: string; dueDate?: string; tags?: string[]; clientId?: Related; retreatId?: Related; bookingId?: Related };
const clientName = (client?: Related) => client ? [client.firstName, client.lastName].filter(Boolean).join(' ') || `Client #${client.display_id || ''}` : 'Unknown client';
const fallbackRoute = (row: Notice) => row.description?.match(/(\/admin\/[A-Za-z0-9_?=&/.-]+)/)?.[1] || '';
const idOf = (value?: Related) => value?._id || '';
const titleize = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
const documentTypeOf = (row: Notice) => {
  const known = ['ekg', 'liver', 'liver_panel', 'medications_initial', 'medications_30_day', 'contract', 'questionnaire', 'food_form'];
  const source = `${row.tags?.join(' ') || ''} ${row.name} ${row.description || ''}`.toLowerCase();
  const match = known.find(type => source.includes(type.replace('_', ' ')) || source.includes(type));
  return match ? titleize(match) : row.tags?.find(tag => !['ibogaready', 'client-submission', 'medical-advisor', 'medical-review'].includes(tag)) ? titleize(row.tags.find(tag => !['ibogaready', 'client-submission', 'medical-advisor', 'medical-review'].includes(tag)) as string) : 'Other';
};

export type NotificationScope = { clientId?: string; bookingId?: string; title?: string; subtitle?: string };

const SubmissionNotificationsPage: React.FC<NotificationScope> = ({ clientId, bookingId, title = 'Notifications', subtitle }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Notice[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [retreatFilter, setRetreatFilter] = useState(''); const [documentTypeFilter, setDocumentTypeFilter] = useState(''); const [unreadOnly, setUnreadOnly] = useState(false); const [view, setView] = useState<'current'|'history'|'all'>('current');
  const [preview, setPreview] = useState<{ url: string; name: string; mimeType?: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); const [bulkUpdating, setBulkUpdating] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const response = await api.get('/submission-notifications', { params: { search: search || undefined, status: status || undefined, unreadOnly: unreadOnly || undefined, view, clientId: clientId || undefined, bookingId: bookingId || undefined } }); setRows(response.data || []); setSelectedIds(new Set()); } catch (e: any) { setError(e.response?.data?.message || 'Unable to load notifications.'); } finally { setLoading(false); } }, [search, status, unreadOnly, view, clientId, bookingId]);
  useEffect(() => { const timer = window.setTimeout(load, 200); return () => window.clearTimeout(timer); }, [load]);
  const retreatOptions = useMemo(() => Array.from(new Map(rows.filter(row => idOf(row.retreatId)).map(row => [idOf(row.retreatId), row.retreatId])).values()).sort((a, b) => String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || ''))), [rows]);
  const documentTypeOptions = useMemo(() => Array.from(new Set(rows.map(documentTypeOf))).sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter(row => (!retreatFilter || idOf(row.retreatId) === retreatFilter) && (!documentTypeFilter || documentTypeOf(row) === documentTypeFilter)), [rows, retreatFilter, documentTypeFilter]);
  const unread = useMemo(() => filteredRows.filter(row => !row.notificationReadAt).length, [filteredRows]);
  const visibleIds = useMemo(() => filteredRows.map(row => row._id), [filteredRows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const markRead = async (row: Notice) => { if (row.notificationReadAt) return; await api.patch(`/submission-notifications/${row._id}/read`); setRows(current => current.map(item => item._id === row._id ? { ...item, notificationReadAt: new Date().toISOString() } : item)); window.dispatchEvent(new Event('notifications-updated')); };
  const toggleSelected = (id: string) => setSelectedIds(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAllVisible = () => setSelectedIds(current => { const next = new Set(current); if (allVisibleSelected) visibleIds.forEach(id => next.delete(id)); else visibleIds.forEach(id => next.add(id)); return next; });
  const bulkSetRead = async (read: boolean) => {
    const ids = Array.from(selectedIds); if (!ids.length) return;
    setBulkUpdating(true); setError('');
    try {
      await Promise.all(ids.map(id => api.patch(`/submission-notifications/${id}/${read ? 'read' : 'unread'}`)));
      const readAt = read ? new Date().toISOString() : undefined;
      setRows(current => current.map(item => selectedIds.has(item._id) ? { ...item, notificationReadAt: readAt } : item));
      setSelectedIds(new Set()); window.dispatchEvent(new Event('notifications-updated'));
    } catch (e: any) { setError(e.response?.data?.message || `Unable to mark selected notifications ${read ? 'read' : 'unread'}.`); }
    finally { setBulkUpdating(false); }
  };
  const open = async (row: Notice) => {
    await markRead(row);
    const route = row.sourceRoute || fallbackRoute(row);
    // Booking-document notifications historically pointed at the library. Resolve
    // the linked document and open its protected file endpoint instead.
    if (/booking-documents(?:$|[/?])/.test(route) && row.bookingId?._id) {
      try {
        const kind = String(row.sourceId || '').split(':')[0].toLowerCase();
        const documentType = kind.includes('contract') ? 'contract' : undefined;
        const response = await bookingDocumentsApi.getAll({ bookingId: row.bookingId._id, documentType });
        const document: any = (response.data || []).find((item: any) => item.files?.length);
        const file = document?.files?.[document.files.length - 1];
        if (document?._id && (file?.s3Key || file?.filePath)) {
          const fileResponse = await bookingDocumentsApi.getFile(document._id, file.s3Key || file.filePath);
          const url = URL.createObjectURL(fileResponse.data as Blob);
          setPreview({ url, name: file.originalFileName || file.fileName || document.title || 'Document preview', mimeType: file.mimeType });
          return;
        }
      } catch { /* fall through to the source route */ }
    }
    navigate(route || (row.clientId?._id ? `/admin/clients/${row.clientId._id}` : '/admin/tasks'));
  };
  const complete = async (row: Notice) => { await api.patch(`/tasks/${row._id}/complete`); if (!row.notificationReadAt) await api.patch(`/submission-notifications/${row._id}/read`); setRows(current => view === 'current' ? current.filter(item => item._id !== row._id) : current.map(item => item._id === row._id ? { ...item, status: 'completed', notificationReadAt: item.notificationReadAt || new Date().toISOString() } : item)); window.dispatchEvent(new Event('notifications-updated')); };
  return <div className="min-h-full bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-blue-700"><BellIcon size={22}/></span><div><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="text-sm text-slate-500">{subtitle || 'Current shows actionable items only. Finished-retreat and completed records remain available in History.'}</p></div></div><div className="flex items-center gap-3"><span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">{unread} unread</span><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><RefreshIcon/> Refresh</button></div></header>
    <section className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_160px_170px_190px_180px_auto]"><label className="relative"><SearchIcon className="absolute left-3 top-3 text-slate-400"/><input className="w-full rounded-lg border py-2.5 pl-10 pr-3" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, retreat, booking, or submission…"/></label><select aria-label="Notification view" className="rounded-lg border px-3 py-2.5" value={view} onChange={e => setView(e.target.value as 'current'|'history'|'all')}><option value="current">Current</option><option value="history">History</option><option value="all">All records</option></select><select aria-label="Notification status" className="rounded-lg border px-3 py-2.5" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><select aria-label="Filter by retreat" className="rounded-lg border px-3 py-2.5" value={retreatFilter} onChange={e => setRetreatFilter(e.target.value)}><option value="">All retreats</option>{retreatOptions.map(retreat => <option key={idOf(retreat)} value={idOf(retreat)}>{retreat?.name || retreat?.code || 'Retreat'}</option>)}</select><select aria-label="Filter by document type" className="rounded-lg border px-3 py-2.5" value={documentTypeFilter} onChange={e => setDocumentTypeFilter(e.target.value)}><option value="">All document types</option>{documentTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}</select><label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}/> Unread only</label></section>
    {filteredRows.length > 0 && <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible}/> Select all shown</label><span className="text-sm text-slate-500">{selectedIds.size} selected</span><button type="button" disabled={!selectedIds.size || bulkUpdating} onClick={() => bulkSetRead(true)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40">Mark selected read</button><button type="button" disabled={!selectedIds.size || bulkUpdating} onClick={() => bulkSetRead(false)} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40">Mark selected unread</button></section>}
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">{loading ? <p className="p-8 text-center text-slate-500">Loading notifications…</p> : !filteredRows.length ? <p className="p-8 text-center text-slate-500">No IR submission notifications match these filters.</p> : <div className="divide-y">{filteredRows.map(row => <article key={row._id} className={`grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${!row.notificationReadAt ? 'bg-blue-50/60' : ''}`}><div className="flex min-w-0 gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={selectedIds.has(row._id)} onChange={() => toggleSelected(row._id)} aria-label={`Select ${row.name}`}/><span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${row.notificationReadAt ? 'bg-slate-300' : 'bg-blue-600'}`}/><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{row.name}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{String(row.sourceId || '').split(':')[0].replace(/_/g,' ')}</span><span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{documentTypeOf(row)}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{row.status || 'pending'}</span></div><p className="mt-1 text-sm text-slate-700">{clientName(row.clientId)}{row.clientId?.display_id ? ` · #${row.clientId.display_id}` : ''}{row.retreatId?.name ? ` · ${row.retreatId.name}` : ''}{row.bookingId?.bookingNumber ? ` · Booking #${row.bookingId.bookingNumber}` : ''}</p><p className="mt-1 text-xs text-slate-500">Received {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'recently'}{row.dueDate ? ` · Review due ${new Date(row.dueDate).toLocaleString()}` : ''}</p></div></div><div className="flex flex-wrap gap-2 md:justify-end">{!row.notificationReadAt && <button onClick={() => markRead(row)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Mark read</button>}<button onClick={() => open(row)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><ExternalLinkIcon/> Open source</button>{row.status !== 'completed' && <button onClick={() => complete(row)} className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700"><CheckIcon/> Reviewed</button>}</div></article>)}</div>}</section>
  </div>{preview && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}><div className="flex h-[min(90vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}><header className="flex items-center justify-between border-b px-4 py-3"><div className="min-w-0"><h2 className="truncate font-semibold text-slate-900">{preview.name}</h2><p className="text-xs text-slate-500">Protected document preview</p></div><div className="flex items-center gap-2"><a href={preview.url} download={preview.name} className="rounded-lg border px-3 py-2 text-sm font-semibold">Download</a><button type="button" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Close</button></div></header><div className="min-h-0 flex-1 bg-slate-100 p-3">{preview.mimeType?.startsWith('image/') ? <img src={preview.url} alt={preview.name} className="mx-auto max-h-full max-w-full object-contain" /> : <iframe src={preview.url} title={preview.name} className="h-full w-full rounded border bg-white" />}</div></div></div>}</div>;
};
export default SubmissionNotificationsPage;
