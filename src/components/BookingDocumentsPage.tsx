import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpDown, Clipboard, ClipboardList, Database, Eye, FileHeart, FileSignature, FileText, FlaskConical, HeartPulse, Pill, RefreshCw, Search, SlidersHorizontal, Trash2, Utensils, X } from 'lucide-react';
import { bookingDocumentsApi } from '../services/api';
import { BookingDocument, Client, Retreat, RetreatClient } from '../types';

type SortKey = 'receivedAt' | 'documentType' | 'booking' | 'client' | 'retreat';
type SortDirection = 'asc' | 'desc';
type LibraryTab = 'files' | 'data';
type DataCategory = 'all' | 'contract' | 'medical' | 'questionnaire' | 'food';
type SubmittedDataRecord = { id: string; category: DataCategory; formType: string; submittedAt?: string; client?: { id?: string; displayId?: number; name?: string; email?: string }; bookingId?: string; retreatId?: string; data: Record<string, any> };

const normalizeKey = (value?: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const formatDate = (value?: Date | string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const getBookingId = (booking?: string | RetreatClient) => {
  if (!booking) return '';
  return typeof booking === 'string' ? booking : booking._id || '';
};

const getBookingLabel = (booking?: string | RetreatClient) => {
  if (!booking) return '-';
  if (typeof booking === 'string') return booking.slice(-8);
  return booking.bookingNumber ? `#${booking.bookingNumber}` : booking._id ? `#${booking._id.slice(-8)}` : '-';
};

const getClientLabel = (client?: string | Client) => {
  if (!client) return '-';
  if (typeof client === 'string') return client.slice(-8);
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  return name || client.email || (client.display_id ? `#${client.display_id}` : client._id?.slice(-8)) || '-';
};

const getRetreatLabel = (retreat?: string | Retreat) => {
  if (!retreat) return '-';
  if (typeof retreat === 'string') return retreat.slice(-8);
  return retreat.name || retreat.code || retreat.retreatCode || retreat._id?.slice(-8) || '-';
};

const titleize = (value: string) => value
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const documentVisual = (value?: string) => {
  const type = normalizeKey(value);
  if (/ceremony.*ekg|ekg.*ceremony/.test(type)) return { Icon: HeartPulse, label: 'Ceremony EKG', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (/ekg|electrocard/.test(type)) return { Icon: Activity, label: 'EKG', color: 'bg-red-50 text-red-700 border-red-200' };
  if (/liver|hepatic/.test(type)) return { Icon: FlaskConical, label: 'Liver', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (/contract|agreement/.test(type)) return { Icon: FileSignature, label: 'Contract', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  if (/medication|medicine|meds/.test(type)) return { Icon: Pill, label: 'Medications', color: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (/food|diet|nutrition/.test(type)) return { Icon: Utensils, label: 'Food', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (/questionnaire|screening|assessment/.test(type)) return { Icon: ClipboardList, label: 'Questionnaire', color: 'bg-sky-50 text-sky-700 border-sky-200' };
  if (/blood|medical|health/.test(type)) return { Icon: FileHeart, label: titleize(type), color: 'bg-pink-50 text-pink-700 border-pink-200' };
  return { Icon: FileText, label: titleize(type || 'document'), color: 'bg-slate-50 text-slate-600 border-slate-200' };
};

const SortHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}> = ({ label, sortKey, activeKey, direction, onSort }) => (
  <button
    type="button"
    onClick={() => onSort(sortKey)}
    className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900"
  >
    {label}
    <ArrowUpDown className={`h-3.5 w-3.5 ${activeKey === sortKey ? 'text-blue-600' : 'text-gray-300'}`} />
    {activeKey === sortKey && <span className="sr-only">sorted {direction}</span>}
  </button>
);

const BookingDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.split('/').filter(Boolean)[0] || 'admin';
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('receivedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deletingDocument, setDeletingDocument] = useState<BookingDocument | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<LibraryTab>('files');
  const [dataCategory, setDataCategory] = useState<DataCategory>('all');
  const [submittedData, setSubmittedData] = useState<SubmittedDataRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [dataQuery, setDataQuery] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [openingFile, setOpeningFile] = useState('');
  const [selectedData, setSelectedData] = useState<SubmittedDataRecord | null>(null);
  const [findingDataFor, setFindingDataFor] = useState('');
  const [highlightedDocument, setHighlightedDocument] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await bookingDocumentsApi.getAll({ summary: true });
      setDocuments(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (activeTab !== 'data') return;
    setDataLoading(true); setDataError('');
    bookingDocumentsApi.getSubmittedData(dataCategory)
      .then((response) => setSubmittedData(response.data || []))
      .catch((loadError: any) => setDataError(loadError?.response?.data?.message || 'Unable to load submitted form data.'))
      .finally(() => setDataLoading(false));
  }, [activeTab, dataCategory]);

  const visibleSubmittedData = useMemo(() => {
    const needle = dataQuery.trim().toLowerCase();
    if (!needle) return submittedData;
    return submittedData.filter((record) => [record.formType, record.category, record.client?.name, record.client?.email, record.client?.displayId, record.bookingId, JSON.stringify(record.data)].join(' ').toLowerCase().includes(needle));
  }, [dataQuery, submittedData]);

  const copyJson = async (record: SubmittedDataRecord) => {
    await navigator.clipboard.writeText(JSON.stringify(record.data, null, 2));
    setCopiedId(record.id); window.setTimeout(() => setCopiedId(''), 1500);
  };

  const sourceIdForDocument = (document: BookingDocument) => String(document.metadata?.clientContractId || document.metadata?.intakeId || document.metadata?.questionnaireId || document.metadata?.foodFormId || '');
  const linkedDocumentFor = (record: SubmittedDataRecord) => documents.find((document) => String(record.data?.booking_document_id || '') === String(document._id || '') || sourceIdForDocument(document) === String(record.id));
  const linkedDataFor = (document: BookingDocument, records = submittedData) => records.find((record) => String(record.data?.booking_document_id || '') === String(document._id || '') || sourceIdForDocument(document) === String(record.id));
  const showLinkedDocument = (record: SubmittedDataRecord) => {
    const document = linkedDocumentFor(record); if (!document) return;
    setQuery(String(document.display_id || document._id || '')); setHighlightedDocument(String(document._id)); setActiveTab('files');
    window.setTimeout(() => document._id && window.document.getElementById(`booking-document-${document._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };
  const showDocumentData = async (document: BookingDocument) => {
    const existing = linkedDataFor(document); if (existing) { setSelectedData(existing); return; }
    setFindingDataFor(String(document._id)); setError('');
    try {
      const response = await bookingDocumentsApi.getSubmittedData('all'); const rows = response.data || [];
      setSubmittedData(rows); const match = linkedDataFor(document, rows);
      if (!match) throw new Error('No structured submitted data is linked to this document.');
      setSelectedData(match);
    } catch (findError: any) { setError(findError?.response?.data?.message || findError?.message || 'Unable to load submitted data.'); }
    finally { setFindingDataFor(''); }
  };

  const openFile = async (document: BookingDocument, fileIndex: number) => {
    if (!document._id) return;
    const key = `${document._id}-${fileIndex}`; setOpeningFile(key); setError('');
    try {
      const response = await bookingDocumentsApi.getOne(document._id);
      const file = (response.data.files || [])[fileIndex];
      if (!file?.url) throw new Error('The file URL is unavailable.');
      window.open(file.url, '_blank', 'noopener,noreferrer');
    } catch (openError: any) { setError(openError?.response?.data?.message || openError?.message || 'Unable to open the file.'); }
    finally { setOpeningFile(''); }
  };

  const documentTypes = useMemo(() => {
    return Array.from(new Set(documents.map((document) => normalizeKey(document.documentType)).filter(Boolean))).sort();
  }, [documents]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'receivedAt' ? 'desc' : 'asc');
  };

  const confirmDelete = async () => {
    if (!deletingDocument?._id || deleteReason.trim().length < 2) return;
    setDeleting(true);
    setError('');
    try {
      await bookingDocumentsApi.delete(deletingDocument._id, deleteReason.trim());
      setDocuments((current) => current.filter((document) => document._id !== deletingDocument._id));
      setDeletingDocument(null);
      setDeleteReason('');
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || deleteError?.message || 'Unable to delete the document.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = documents.filter((document) => {
      const type = normalizeKey(document.documentType);
      if (typeFilter !== 'all' && type !== typeFilter) return false;

      if (!normalizedQuery) return true;
      const haystack = [
        document.display_id,
        document.title,
        document.description,
        document.documentType,
        document.status,
        getBookingLabel(document.bookingId),
        getClientLabel(document.clientId),
        getRetreatLabel(document.retreatId),
        ...(document.files || []).map((file) => `${file.fileName || ''} ${file.originalFileName || ''} ${file.s3Key || ''} ${file.filePath || ''}`),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const valueFor = (document: BookingDocument) => {
        if (sortKey === 'receivedAt') return new Date(document.receivedAt || document.createdAt || 0).getTime();
        if (sortKey === 'documentType') return titleize(document.documentType || '').toLowerCase();
        if (sortKey === 'booking') return getBookingLabel(document.bookingId).toLowerCase();
        if (sortKey === 'client') return getClientLabel(document.clientId).toLowerCase();
        return getRetreatLabel(document.retreatId).toLowerCase();
      };
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
  }, [documents, query, sortDirection, sortKey, typeFilter]);

  if (activeTab === 'data') return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-2xl font-semibold text-gray-900">Document Library</h1><p className="mt-1 text-sm text-gray-600">Structured data received from IbogaReady and stored in the database.</p></div></div>
      <div className="mb-5 flex border-b border-gray-200"><button onClick={() => setActiveTab('files')} className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-gray-500 hover:text-gray-800"><FileText className="h-4 w-4"/>Documents</button><button className="inline-flex items-center gap-2 border-b-2 border-blue-600 px-4 py-3 text-sm font-semibold text-blue-700"><Database className="h-4 w-4"/>Submitted data</button></div>
      <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={dataQuery} onChange={(e) => setDataQuery(e.target.value)} placeholder="Search client, email, booking, or submitted values" className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm"/></label><select value={dataCategory} onChange={(e) => setDataCategory(e.target.value as DataCategory)} className="rounded-md border border-gray-300 px-3 py-2 text-sm"><option value="all">All form data</option><option value="contract">Contracts</option><option value="medical">Medical forms</option><option value="questionnaire">Questionnaires</option><option value="food">Food data</option></select></div>
      {dataError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dataError}</div>}
      <div className="mb-3 text-sm text-gray-600">{dataLoading ? 'Loading submitted data…' : `${visibleSubmittedData.length} stored submission${visibleSubmittedData.length === 1 ? '' : 's'}`}</div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Type</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Client</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Booking</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Submitted</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Document</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Data</th></tr></thead><tbody className="divide-y divide-gray-200">{visibleSubmittedData.map((record) => { const linked = linkedDocumentFor(record); const visual = documentVisual(record.formType); const TypeIcon = visual.Icon; return <tr key={`${record.category}-${record.id}`} className="hover:bg-gray-50"><td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${visual.color}`}><TypeIcon className="h-4 w-4"/></span><span className="text-sm font-semibold text-gray-800">{titleize(record.formType)}</span></span></td><td className="px-4 py-3 text-sm text-gray-800">{record.client?.name || record.client?.email || `Client ${record.client?.id?.slice(-8) || '-'}`}{record.client?.displayId ? <span className="ml-1 text-xs text-gray-500">#{record.client.displayId}</span> : null}</td><td className="px-4 py-3 text-sm text-gray-600">{record.bookingId ? record.bookingId.slice(-8) : '-'}</td><td className="px-4 py-3 text-sm text-gray-600">{formatDate(record.submittedAt)}</td><td className="px-4 py-3">{linked ? <button onClick={() => showLinkedDocument(record)} className="text-sm font-semibold text-blue-700 hover:text-blue-900">{linked.title || `Document #${linked.display_id || linked._id?.slice(-8)}`}</button> : <span className="text-sm text-gray-400">Not linked</span>}</td><td className="px-4 py-3 text-right"><button onClick={() => setSelectedData(record)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Database className="h-3.5 w-3.5"/>View JSON</button></td></tr>;})}{!dataLoading && visibleSubmittedData.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">No stored submissions match this filter.</td></tr>}</tbody></table></div></div>
      {selectedData && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="submitted-data-title"><div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4"><div><h2 id="submitted-data-title" className="text-lg font-semibold text-gray-900">{titleize(selectedData.formType)} data</h2><p className="mt-1 text-xs text-gray-500">{selectedData.client?.name || selectedData.client?.email || 'Client'} · {formatDate(selectedData.submittedAt)}</p></div><div className="flex gap-2"><button onClick={() => copyJson(selectedData)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700"><Clipboard className="h-3.5 w-3.5"/>{copiedId === selectedData.id ? 'Copied' : 'Copy JSON'}</button><button onClick={() => setSelectedData(null)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5"/></button></div></header><pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-5 font-mono text-xs leading-5 text-slate-100">{JSON.stringify(selectedData.data, null, 2)}</pre></div></div>}
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Document Library</h1>
          <p className="mt-1 text-sm text-gray-600">Booking files with previews, document type, booking, client, retreat, and upload details.</p>
        </div>
        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-5 flex border-b border-gray-200"><button className="inline-flex items-center gap-2 border-b-2 border-blue-600 px-4 py-3 text-sm font-semibold text-blue-700"><FileText className="h-4 w-4"/>Documents</button><button onClick={() => setActiveTab('data')} className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-gray-500 hover:text-gray-800"><Database className="h-4 w-4"/>Submitted data</button></div>

      <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search booking #, client, retreat, document type, title, or file name"
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="relative block">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All document types</option>
            {documentTypes.map((type) => (
              <option key={type} value={type}>{titleize(type)}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600">
          {loading ? 'Loading documents...' : `${filteredDocuments.length} document${filteredDocuments.length === 1 ? '' : 's'}`}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Kind</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Document</th>
                <th className="px-4 py-3 text-left"><SortHeader label="Type" sortKey="documentType" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-4 py-3 text-left"><SortHeader label="Booking" sortKey="booking" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-4 py-3 text-left"><SortHeader label="Client" sortKey="client" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-4 py-3 text-left"><SortHeader label="Retreat" sortKey="retreat" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-4 py-3 text-left"><SortHeader label="Received" sortKey="receivedAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort} /></th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Files</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {!loading && filteredDocuments.map((document) => {
                const bookingId = getBookingId(document.bookingId);
                const visual = documentVisual(document.documentType); const TypeIcon = visual.Icon;
                return (
                  <tr id={`booking-document-${document._id}`} key={document._id} className={`hover:bg-gray-50 ${highlightedDocument === document._id ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}>
                    <td className="px-4 py-4 align-top">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${visual.color}`} title={visual.label}><TypeIcon className="h-6 w-6"/><span className="sr-only">{visual.label}</span></div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-gray-900">{document.title || titleize(document.documentType)}</div>
                      <div className="mt-1 text-xs text-gray-500">#{document.display_id || document._id?.slice(-8)}</div>
                      {document.description && <div className="mt-1 max-w-md text-xs text-gray-500">{document.description}</div>}
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {titleize(document.documentType)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      {bookingId ? (
                        <button type="button" className="font-semibold text-blue-700 hover:text-blue-900" onClick={() => navigate(`/${routePrefix}/bookings/${bookingId}`)}>
                          {getBookingLabel(document.bookingId)}
                        </button>
                      ) : (
                        <span className="text-gray-500">{getBookingLabel(document.bookingId)}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-gray-900">{getClientLabel(document.clientId)}</td>
                    <td className="px-4 py-4 align-top text-sm text-gray-900">{getRetreatLabel(document.retreatId)}</td>
                    <td className="px-4 py-4 align-top text-sm text-gray-600">{formatDate(document.receivedAt || document.createdAt)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        {(document.files || []).length === 0 && <span className="text-sm text-gray-400">No files</span>}
                        {(document.files || []).map((file, index) => (
                          <button
                            key={`${document._id}-${file.s3Key || file.filePath || file.fileName || index}`}
                            type="button"
                            onClick={() => openFile(document, index)}
                            disabled={openingFile === `${document._id}-${index}`}
                            className="inline-flex max-w-xs items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={file.originalFileName ? `Original upload: ${file.originalFileName}` : 'Open uploaded file'}
                          >
                            {openingFile === `${document._id}-${index}` ? <RefreshCw className="h-3.5 w-3.5 flex-none animate-spin"/> : <Eye className="h-3.5 w-3.5 flex-none" />}
                            <span className="truncate">{file.fileName || 'Uploaded file'}</span>
                            <span className="flex-none text-gray-400">({formatBytes(file.size)})</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right align-top"><div className="flex flex-col items-end gap-2">
                      {sourceIdForDocument(document) && <button type="button" onClick={() => showDocumentData(document)} disabled={findingDataFor === document._id} className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Database className="h-3.5 w-3.5"/>{findingDataFor === document._id ? 'Loading…' : 'Submitted data'}</button>}
                      <button
                        type="button"
                        onClick={() => { setDeletingDocument(document); setDeleteReason(''); }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div></td>
                  </tr>
                );
              })}
              {!loading && filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">
                    No booking documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deletingDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-document-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-document-title" className="text-lg font-semibold text-gray-900">Delete document?</h2>
                <p className="mt-1 text-sm text-gray-600">{deletingDocument.title || titleize(deletingDocument.documentType)} #{deletingDocument.display_id || deletingDocument._id?.slice(-8)}</p>
              </div>
              <button type="button" onClick={() => setDeletingDocument(null)} disabled={deleting} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-700">The document will be removed from the library but retained as a deleted record. The user, timestamp, reason, and document details will be recorded in Audit Logs.</p>
            <label className="mt-4 block text-sm font-semibold text-gray-800">
              Deletion reason <span className="text-red-600">*</span>
              <textarea autoFocus rows={3} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Why is this document being deleted?" className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingDocument(null)} disabled={deleting} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting || deleteReason.trim().length < 2} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting...' : 'Delete document'}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedData && <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="submitted-data-title"><div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4"><div><h2 id="submitted-data-title" className="text-lg font-semibold text-gray-900">{titleize(selectedData.formType)} data</h2><p className="mt-1 text-xs text-gray-500">{selectedData.client?.name || selectedData.client?.email || 'Client'} · {formatDate(selectedData.submittedAt)}</p></div><div className="flex gap-2"><button onClick={() => copyJson(selectedData)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700"><Clipboard className="h-3.5 w-3.5"/>{copiedId === selectedData.id ? 'Copied' : 'Copy JSON'}</button><button onClick={() => setSelectedData(null)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5"/></button></div></header><pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-5 font-mono text-xs leading-5 text-slate-100">{JSON.stringify(selectedData.data, null, 2)}</pre></div></div>}
    </div>
  );
};

export default BookingDocumentsPage;
