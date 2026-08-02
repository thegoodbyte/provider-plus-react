import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpDown, Clipboard, Database, Eye, FileText, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { bookingDocumentsApi } from '../services/api';
import { BookingDocument, Client, Retreat, RetreatClient } from '../types';

type SortKey = 'receivedAt' | 'documentType' | 'booking' | 'client' | 'retreat';
type SortDirection = 'asc' | 'desc';
type BookingDocumentFile = NonNullable<BookingDocument['files']>[number];
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

const isPdfFile = (file: BookingDocumentFile) => {
  const name = `${file?.fileName || file?.s3Key || file?.filePath || ''}`.toLowerCase();
  return file?.mimeType === 'application/pdf' || name.endsWith('.pdf');
};

const isImageFile = (file: BookingDocumentFile) => {
  return Boolean(file?.mimeType?.startsWith('image/'));
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

const FilePreview: React.FC<{ file?: BookingDocumentFile }> = ({ file }) => {
  if (!file) {
    return (
      <div className="flex h-20 w-16 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-gray-400">
        <FileText className="h-5 w-5" />
      </div>
    );
  }

  if (file.thumbnailUrl || (isImageFile(file) && file.url)) {
    return (
      <img
        src={file.thumbnailUrl || file.url}
        alt={file.fileName || 'Document preview'}
        className="h-20 w-16 rounded-md border border-gray-200 bg-white object-cover"
      />
    );
  }

  if (isPdfFile(file) && file.url) {
    return (
      <iframe
        title={file.fileName || 'PDF preview'}
        src={`${file.url}#page=1&toolbar=0&navpanes=0&scrollbar=0`}
        className="h-20 w-16 overflow-hidden rounded-md border border-gray-200 bg-white"
      />
    );
  }

  return (
    <div className="flex h-20 w-16 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500">
      <FileText className="h-5 w-5" />
    </div>
  );
};

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

  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await bookingDocumentsApi.getAll();
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

  const documentTypes = useMemo(() => {
    return Array.from(new Set(documents.map((document) => normalizeKey(document.documentType)).filter((type) => type && type !== 'ekg' && type !== 'liver_panel'))).sort();
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
      if (type === 'ekg' || type === 'liver_panel') return false;
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
      <div className="space-y-4">{visibleSubmittedData.map((record) => <article key={`${record.category}-${record.id}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"><header className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{titleize(record.formType)}</span><strong className="text-sm text-gray-900">{record.client?.name || record.client?.email || `Client ${record.client?.id?.slice(-8) || '-'}`}</strong>{record.client?.displayId && <span className="text-xs text-gray-500">#{record.client.displayId}</span>}</div><div className="mt-1 text-xs text-gray-500">Submitted {formatDate(record.submittedAt)}{record.bookingId ? ` · Booking ${record.bookingId.slice(-8)}` : ''}</div></div><button onClick={() => copyJson(record)} className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Clipboard className="h-3.5 w-3.5"/>{copiedId === record.id ? 'Copied' : 'Copy JSON'}</button></header><pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5 text-gray-800">{JSON.stringify(record.data, null, 2)}</pre></article>)}{!dataLoading && visibleSubmittedData.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">No stored submissions match this filter.</div>}</div>
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</th>
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
                const primaryFile = (document.files || [])[0];
                return (
                  <tr key={document._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 align-top">
                      <FilePreview file={primaryFile} />
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
                            onClick={() => file.url && window.open(file.url, '_blank', 'noopener,noreferrer')}
                            disabled={!file.url}
                            className="inline-flex max-w-xs items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={file.originalFileName ? `Original upload: ${file.originalFileName}` : file.url ? 'Open uploaded file' : 'File URL unavailable'}
                          >
                            <Eye className="h-3.5 w-3.5 flex-none" />
                            <span className="truncate">{file.fileName || 'Uploaded file'}</span>
                            <span className="flex-none text-gray-400">({formatBytes(file.size)})</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <button
                        type="button"
                        onClick={() => { setDeletingDocument(document); setDeleteReason(''); }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </td>
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
    </div>
  );
};

export default BookingDocumentsPage;
